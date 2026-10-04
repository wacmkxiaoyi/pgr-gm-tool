import asyncio
import copy
import os
from pathlib import Path
import re
import shutil
import subprocess
from types import SimpleNamespace

import pytest
from bson import BSON, Binary, json_util
from bson.int64 import Int64

from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime
from backend.app.services.player import player_stages_service
from backend.app.services.player.player_stages_service import PlayerStagesService


def test_latest_state_defaults_and_removed_fields():
    schema = DatabaseSchemaRuntime().get_collection_schema('players')
    assert schema.build_default('purchase_daily_passes.0.v')['LastClaimDay'] == -1
    assert schema.build_default('pending_purchase.DailyPasses.0.v')['LastClaimDay'] == -1
    assert schema.build_default('partner_decompose_completions') is None
    assert schema.materialize_subpath('partner_decompose_completions', None) is None
    assert schema.materialize_subpath('partner_decompose_completions', []) == []
    assert schema.build_default('pending_partner_decompose') is None
    assert schema.build_default('pending_recharge') is None
    assert schema.build_default('recharge_sequence') == 0
    world = schema.build_default('big_world_state')
    for field in ('last_self_runtime_id', 'big_world_course_read_element_ids', 'big_world_course_task_progress'):
        assert field not in world
        assert not schema.allows_update_path('big_world_state.' + field)
    assert world['sg_cafe'] is None and world['sg_dorm'] is None and world['sg_drone_current'] is None
    assert world['sg_street']['CurStageData'] is None
    assert world['scene_object_states'] == []
    assert world['quest_data']['ActiveQuests'] == []
    assert DatabaseSchemaRuntime().get_collection_schema('stages').build_default('boss_single_activity_no') is None


def test_bigworld_binary_ledgers_and_nested_ids_survive_materialization():
    schema = DatabaseSchemaRuntime().get_collection_schema('players')
    value = {
        'scene_object_states': [{'k': 1, 'v': {'states': [{'k': 900, 'v': Binary(b'\x81\xff\x00')} ]}}],
        'sg_drone_current': {'stage_id': 2, 'seed': 4, 'is_hard_mode': True, 'save_data': Binary(b'\x92\x01\x02')},
        'album_photos': [{'_id': 7, 'create_time': Int64(1900000000), 'remark': 'photo'}],
        'sg_street': {'CurStageData': {'TaskDatas': [{'_id': 9, 'ConfigId': 17}], 'OperatingData': {
            'CustomerDatas': [{'_id': 21, 'CommandDatas': [{'_id': 22, 'EventData': {'_id': 23}}]}],
        }}},
        'quest_data': {'ActiveQuests': [{'k': 100, 'v': {'QuestId': 100, 'DynamicData': {
            'Steps': [{'k': 101, 'v': {'Objectives': [{'k': 102, 'v': {
                '_id': 102, 'TimerStarted': True, 'TimerElapsedMs': 300, 'KilledEnemies': [9],
            }}]}}], 'FuncEntryEnabled': [3],
        }}}]},
    }
    normalized = schema.materialize_subpath('big_world_state', value)
    decoded = BSON.encode(normalized).decode()
    assert decoded['scene_object_states'][0]['v']['states'][0]['v'] == b'\x81\xff\x00'
    assert decoded['sg_drone_current']['save_data'] == b'\x92\x01\x02'
    assert decoded['sg_drone_current']['is_hard_mode'] is True
    assert decoded['album_photos'][0]['_id'] == 7
    assert isinstance(decoded['album_photos'][0]['create_time'], Int64)
    stage = decoded['sg_street']['CurStageData']
    assert stage['TaskDatas'][0]['_id'] == 9
    assert stage['OperatingData']['CustomerDatas'][0]['CommandDatas'][0]['EventData']['_id'] == 23
    objective = decoded['quest_data']['ActiveQuests'][0]['v']['DynamicData']['Steps'][0]['v']['Objectives'][0]['v']
    assert objective['_id'] == 102 and objective['TimerStarted'] is True
    assert objective['TimerElapsedMs'] == 300 and objective['KilledEnemies'] == [9]


def test_purchase_and_decompose_receipts_preserve_current_shapes():
    schema = DatabaseSchemaRuntime().get_collection_schema('players')
    state = {
        'purchase_daily_passes': [{'k': 100, 'v': {'EndDay': Int64(20020), 'StartDay': Int64(20000), 'LastClaimDay': Int64(-1), 'RewardIndexList': [1, 2]}}],
        'pending_recharge': {'Key': 'pay:7', 'Order': 'local:42:1', 'Count': 60},
        'recharge_sequence': Int64(1),
        'pending_partner_decompose': {'ClaimKey': 'partner:42:1', 'PartnerIds': [7], 'RewardGoodsList': [{'_id': 3, 'TemplateId': 60, 'Count': 5}]},
    }
    normalized = schema.sanitize_document(state, fill_defaults=False)
    assert normalized == state
    assert BSON.encode(normalized).decode() == state
    update = schema.materialize_update_fields({'player_data.Name': 'name'})
    assert update == {'player_data.Name': 'name'}


def test_stage_edit_does_not_reset_boss_period(monkeypatch):
    document = {'_id': 'stage', 'boss_single_activity_no': 2950, 'stages': []}
    updates = []

    class Collection:
        async def find_one(self, *args, **kwargs):
            return copy.deepcopy(document)

        async def update_one(self, query, update):
            updates.append(update)
            return SimpleNamespace(modified_count=1)

    collection = Collection()

    class Client:
        def __getitem__(self, name):
            return self if name == 'test' else collection

        def close(self):
            pass

    monkeypatch.setattr(player_stages_service, 'create_mongo_client', lambda _: Client())
    monkeypatch.setattr(player_stages_service, 'get_stage_entries_map', lambda: {1: {'Name': 'stage'}})
    service = PlayerStagesService(SimpleNamespace(mongo_db='test'), DatabaseSchemaRuntime())
    asyncio.run(service.add_stages(42, [1]))
    assert set(updates[0]) == {'$push'} and set(updates[0]['$push']) == {'stages'}
    asyncio.run(service.clear_stages(42))
    assert updates[1] == {'$set': {'stages': []}}


def _read_persisted_classes(server):
    """Extract actual C# auto-properties/BSON attributes; ignore protocol-only attributes.

    The reduced types compile in memory on .NET Framework. Defaults are supplied
    by GM materialization so they can be verified against the original source.
    """
    files = list((server / 'AscNet.Common/Database/BigWorld').glob('*.cs')) + [
        server / 'AscNet.Common/Database/Player.Purchases.cs',
        server / 'AscNet.Common/Database/Player.PartnerArchive.cs',
        server / 'AscNet.Common/MsgPack/BigWorld/SkyGarden.cs',
        server / 'AscNet.Common/MsgPack/BigWorld/SgStreet.cs',
        server / 'AscNet.Common/MsgPack/Theatre5.cs',
        server / 'AscNet.Common/MsgPack/Types.cs',
    ]
    classes = {}
    pattern = re.compile(r'(?P<attrs>(?:\[[^\n]+?\]\s*)*)public\s+(?P<type>[\w.<>?, \[\]]+)\s+(?P<name>\w+)\s*\{\s*get;\s*set;\s*\}(?P<init>[^\n]*)')
    for file in files:
        text = file.read_text(encoding='utf-8-sig')
        # Match property bodies with a single brace pair; class body ends at a
        # line with the class's own indentation (nested Types.cs classes included).
        for match in re.finditer(r'(?m)^(?P<indent> *)public (?:sealed |partial )?class (?P<name>\w+)[^\n]*\n *\{', text):
            end = re.search(r'(?m)^' + re.escape(match['indent']) + r'\}', text[match.end():])
            if not end:
                continue
            body = text[match.end():match.end() + end.start()]
            properties = list(pattern.finditer(body))
            classes.setdefault(match['name'], []).extend(properties)
    return classes


def test_latest_schema_against_actual_server_types_and_mongodb_driver():
    server = Path(os.environ.get('INFINITELOOP_TEST_PATH', str(Path(__file__).resolve().parents[2].parent / 'InfiniteLoop')))
    driver = Path(os.environ.get('MONGODB_BSON_TEST_DLL', str(Path.home() / '.nuget/packages/mongodb.bson/2.21.0/lib/net472/MongoDB.Bson.dll')))
    powershell = shutil.which('powershell')
    if not powershell or not driver.is_file() or not (server / 'AscNet.Common/Database/BigWorld').is_dir():
        pytest.skip('Requires InfiniteLoop source, Windows PowerShell and MongoDB.Bson 2.21.0')
    classes = _read_persisted_classes(server)
    runtime = DatabaseSchemaRuntime()
    schema = runtime.get_collection_schema('players')
    roots = {
        'big_world_state': 'BigWorldPlayerState', 'purchase_daily_passes': 'Dictionary<uint, PlayerPurchaseDailyPass>',
        'pending_purchase': 'PlayerPendingPurchase', 'pending_recharge': 'PlayerPendingRecharge',
        'pending_partner_decompose': 'PartnerDecomposePendingOperation',
        'partner_decompose_completions': 'List<PartnerDecomposeCompletion>',
    }
    primitives = {'int', 'uint', 'long', 'float', 'double', 'bool', 'string', 'byte', 'object', 'Int32', 'UInt32', 'Int64', 'UInt64', 'Boolean', 'String', 'Single', 'Double', 'Byte', 'List', 'Dictionary', 'HashSet', 'dynamic'}
    emitted = set()
    declarations = []

    def build(type_name, node):
        nullable = type_name.endswith('?')
        plain = type_name.rstrip('?').replace('AscNet.Common.MsgPack.', '')
        if plain == 'byte[]':
            assert node['type'] == 'binary'
            return None if nullable else Binary(b'')
        if plain in primitives:
            value = node.get('default')
            if value is None and 'default' not in node and plain in {'string', 'String'}:
                value = ''
            if value is None and not nullable and plain not in {'string', 'String', 'object', 'dynamic'}:
                value = False if plain in {'bool', 'Boolean'} else 0
            if value is not None and plain in {'long', 'Int64', 'UInt64'}:
                return Int64(value)
            if value is not None and plain in {'float', 'double', 'Single', 'Double'}:
                return float(value)
            return value
        if plain.startswith(('List<', 'HashSet<')):
            inner = plain[plain.index('<') + 1:-1].strip()
            value = build(inner, node['schema'])
            return [value]
        if plain.startswith('Dictionary<'):
            inner = plain[len('Dictionary<'):-1]
            key, value_type = inner.split(',', 1)
            if node['type'] == 'object':
                inner_type = value_type.strip()
                if inner_type in {'Theatre5DlcVector2', 'Theatre5DlcVector3'}:
                    axes = ('X', 'Y') if inner_type.endswith('2') else ('X', 'Y', 'Z')
                    vector = {'type': 'object', 'schema': {
                        axis: {'type': 'number', 'default': 0} for axis in axes
                    }}
                    return {'sample': build(inner_type, vector)}
                return {'sample': build(inner_type, {'type': 'number', 'default': False if inner_type == 'bool' else 0})}
            assert node['type'] == 'array', plain
            return [{'k': 'sample' if key.strip() == 'string' else 1, 'v': build(value_type.strip(), node['schema']['v'])}]
        assert plain in classes, plain
        properties = classes[plain]
        fields = node.get('schema', node)
        bson_names = set()
        sample = {}
        lines = []
        for prop in properties:
            attrs = prop['attrs']
            if 'BsonIgnore]' in attrs:
                continue
            member_type = prop['type'].strip().replace('AscNet.Common.MsgPack.', '')
            name = prop['name']
            element = re.search(r'BsonElement\("([^"]+)"\)', attrs)
            bson_name = '_id' if name == 'Id' else element[1] if element else name
            assert bson_name in fields, f'{plain}.{name} missing BSON field {bson_name}'
            bson_names.add(bson_name)
            sample[bson_name] = build(member_type, fields[bson_name])
            bson_attrs = re.findall(r'Bson(?:Element\("[^"]+"\)|DictionaryOptions\(DictionaryRepresentation\.ArrayOfDocuments\)|IgnoreIfNull|Id)', attrs)
            rendered_attrs = ''.join('[' + attr + ']' for attr in bson_attrs)
            compiler_type = member_type
            if compiler_type.endswith('?') and compiler_type[:-1] not in {'int', 'uint', 'long', 'float', 'double', 'bool'}:
                compiler_type = compiler_type[:-1]
            lines.append(f'{rendered_attrs} public {compiler_type} {name} {{ get; set; }}')
        assert set(fields) == bson_names, f'{plain} extra fields: {set(fields) - bson_names}'
        if plain not in emitted:
            emitted.add(plain)
            declarations.append(f'public class {plain} {{ ' + '\n'.join(lines) + ' }')
        return sample

    payload = {name: build(type_name, schema.resolve(name)) for name, type_name in roots.items()}
    # Compare both the server's exact property graph and the driver's strict
    # deserialization of a populated GM document, including all nested Id fields.
    normalized = {name: schema.materialize_subpath(name, value) for name, value in payload.items()}
    declarations.append('public class LatestDocument {' + ''.join(
        f'[BsonElement("{name}")] public {type_name} Field{index} {{ get; set; }}'
        if not type_name.startswith('Dictionary<') else
        f'[BsonElement("{name}")][BsonDictionaryOptions(DictionaryRepresentation.ArrayOfDocuments)] public {type_name} Field{index} {{ get; set; }}'
        for index, (name, type_name) in enumerate(roots.items())
    ) + '}')
    code = 'using System; using System.Collections.Generic; using MongoDB.Bson; using MongoDB.Bson.Serialization; using MongoDB.Bson.Serialization.Attributes; using MongoDB.Bson.Serialization.Options;\n'
    code += '\n'.join(declarations)
    code += '''
public static class SchemaBsonVerification {
    private static bool Equal(BsonValue left, BsonValue right) {
        if (left.IsBsonDocument && right.IsBsonDocument) {
            var a = left.AsBsonDocument; var b = right.AsBsonDocument;
            if (a.ElementCount != b.ElementCount) return false;
            foreach (var field in a) {
                BsonValue value;
                if (!b.TryGetValue(field.Name, out value) || !Equal(field.Value, value)) return false;
            }
            return true;
        }
        if (left.IsBsonArray && right.IsBsonArray) {
            var a = left.AsBsonArray; var b = right.AsBsonArray;
            if (a.Count != b.Count) return false;
            for (int i = 0; i < a.Count; i++) if (!Equal(a[i], b[i])) return false;
            return true;
        }
        // C# uint serializes as Int64; Python emits small non-negative IDs as
        // Int32. Both are accepted by the driver's uint serializer.
        if (left.IsNumeric && right.IsNumeric) return left.ToDouble() == right.ToDouble();
        return left.Equals(right);
    }
    public static void Verify(string json) {
        var source = BsonDocument.Parse(json);
        var value = BsonSerializer.Deserialize<LatestDocument>(source);
        var result = value.ToBsonDocument();
        if (!Equal(source, result)) throw new Exception("BSON fields or values changed during server round-trip: " + result.ToJson());
    }
}
'''
    result = subprocess.run([
        powershell, '-NoProfile', '-NonInteractive', '-File', str(Path(__file__).with_name('verify_schema_bson.ps1')),
        '-DriverPath', str(driver),
    ], input=json_util.dumps({'Source': code, 'Payload': json_util.dumps(normalized)}), capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, result.stdout + result.stderr
