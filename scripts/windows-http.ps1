$ErrorActionPreference = 'Stop'
$taskRequest = [Console]::In.ReadToEnd() | ConvertFrom-Json
$taskHeaders = @{}
foreach ($taskProperty in $taskRequest.headers.PSObject.Properties) { $taskHeaders[$taskProperty.Name] = $taskProperty.Value }
try {
  $taskArguments = @{ Uri=$taskRequest.url; Method=$taskRequest.method; Headers=$taskHeaders; SkipHttpErrorCheck=$true; TimeoutSec=45 }
  if ($taskRequest.body) { $taskArguments.Body = $taskRequest.body }
  $taskResponse = Invoke-WebRequest @taskArguments
  [Console]::Out.Write((@{status=[int]$taskResponse.StatusCode; body=$taskResponse.Content} | ConvertTo-Json -Compress -Depth 3))
} catch {
  [Console]::Error.Write('Windows HTTP request failed: ' + $_.Exception.Message)
  exit 1
}
