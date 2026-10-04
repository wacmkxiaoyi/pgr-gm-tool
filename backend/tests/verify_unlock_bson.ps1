param(
    [Parameter(Mandatory = $true)][string]$DriverPath,
    [Parameter(Mandatory = $true)][string]$Payload
)

$ErrorActionPreference = 'Stop'
# Mirrors the persisted unlock types from InfiniteLoop. MessagePack attributes
# do not participate in BSON mapping and are deliberately absent here.
$source = @'
using System;
using System.Collections.Generic;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Attributes;

public class MedalUnlockState {
    [BsonElement("id")] public int Id { get; set; }
    [BsonElement("time")] public long Time { get; set; }
    [BsonElement("keep_time")] public long KeepTime { get; set; }
}
public class ChatBoardUnlockState {
    [BsonElement("id")] public long Id { get; set; }
    [BsonElement("get_time")] public long GetTime { get; set; }
    [BsonElement("end_time")] public long EndTime { get; set; }
}
public class NameplateData {
    public int Id { get; set; }
    public int Exp { get; set; }
    public long EndTime { get; set; }
    public long GetTime { get; set; }
}
public class UnlockEmoji {
    public uint Id { get; set; }
    public int EndTime { get; set; }
}
public class TitleInfo {
    public uint Id { get; set; }
    public int Quality { get; set; }
    public int Score { get; set; }
    public uint Time { get; set; }
    public int WallId { get; set; }
    public object ExpandInfo { get; set; }
}
public class UnlockDocument {
    [BsonElement("unlocked_medals")] public List<MedalUnlockState> Medals { get; set; }
    [BsonElement("unlocked_chat_boards")] public List<ChatBoardUnlockState> Boards { get; set; }
    [BsonElement("nameplates")] public List<NameplateData> Nameplates { get; set; }
    [BsonElement("chat_emojis")] public List<UnlockEmoji> Emojis { get; set; }
    [BsonElement("score_titles")] public List<TitleInfo> Titles { get; set; }
}
public static class UnlockBsonVerification {
    public static void Verify(string json) {
        Type[] types = { typeof(MedalUnlockState), typeof(ChatBoardUnlockState),
            typeof(NameplateData), typeof(UnlockEmoji), typeof(TitleInfo) };
        foreach (Type type in types) {
            if (BsonClassMap.LookupClassMap(type).IdMemberMap.ElementName != "_id")
                throw new Exception(type.Name + " has an unexpected BSON Id mapping");
        }
        BsonDocument document = BsonDocument.Parse(json);
        UnlockDocument decoded = BsonSerializer.Deserialize<UnlockDocument>(document);
        if (decoded.Medals.Count != 1 || decoded.Medals[0].Id == 0 ||
            decoded.Boards.Count != 1 || decoded.Boards[0].Id == 0 ||
            decoded.Nameplates.Count != 1 || decoded.Nameplates[0].Id == 0 ||
            decoded.Emojis.Count != 1 || decoded.Emojis[0].Id == 0 ||
            decoded.Titles.Count != 1 || decoded.Titles[0].Id == 0)
            throw new Exception("An unlock Id was lost during deserialization");
        // Reproduce the reported failure and prove that a Python BSON round-trip
        // alone would miss this issue: C# rejects both id and Id aliases.
        foreach (string array in new [] { "unlocked_medals", "unlocked_chat_boards", "nameplates", "chat_emojis", "score_titles" }) {
            foreach (string alias in new [] { "id", "Id" }) {
                BsonDocument invalid = (BsonDocument)document.DeepClone();
                BsonDocument item = invalid[array][0].AsBsonDocument;
                item[alias] = item["_id"];
                item.Remove("_id");
                bool rejected = false;
                try { BsonSerializer.Deserialize<UnlockDocument>(invalid); }
                catch (FormatException) { rejected = true; }
                if (!rejected) throw new Exception(array + " unexpectedly accepted " + alias);
            }
        }
    }
}
'@
[void][System.Reflection.Assembly]::LoadFrom($DriverPath)
Add-Type -TypeDefinition $source -ReferencedAssemblies $DriverPath
$json = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Payload))
[UnlockBsonVerification]::Verify($json)
'All five unlock types passed strict MongoDB.Bson deserialization; id/Id aliases rejected.'
