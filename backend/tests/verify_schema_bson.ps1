param(
    [Parameter(Mandatory = $true)][string]$DriverPath
)
$ErrorActionPreference = 'Stop'
[void][System.Reflection.Assembly]::LoadFrom($DriverPath)
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
Add-Type -TypeDefinition $request.Source -ReferencedAssemblies $DriverPath
[SchemaBsonVerification]::Verify($request.Payload)
'Latest persisted types passed strict MongoDB.Bson verification.'
