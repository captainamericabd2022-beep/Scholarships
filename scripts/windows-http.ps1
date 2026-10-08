$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$taskRequest = [Console]::In.ReadToEnd() | ConvertFrom-Json
$taskHeaders = @{}
foreach ($taskProperty in $taskRequest.headers.PSObject.Properties) { $taskHeaders[$taskProperty.Name] = $taskProperty.Value }
try {
  $taskArguments = @{ Uri=$taskRequest.url; Method=$taskRequest.method; Headers=$taskHeaders; SkipHttpErrorCheck=$true; TimeoutSec=45 }
  if ($taskRequest.body) { $taskArguments.Body = [System.Text.Encoding]::UTF8.GetBytes([string]$taskRequest.body) }
  $taskResponse = Invoke-WebRequest @taskArguments
  $taskBodyBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([string]$taskResponse.Content))
  [Console]::Out.Write((@{status=[int]$taskResponse.StatusCode; bodyBase64=$taskBodyBase64} | ConvertTo-Json -Compress -Depth 3))
} catch {
  [Console]::Error.Write('Windows HTTP request failed.')
  exit 1
}
