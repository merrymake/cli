echo Checking requirement: Git
git --version
if($?)
{
  # Success; has git
}
else
{
  echo You need Git to use the Merrymake CLI. You can get it from here: https://git-scm.com/downloads
}
echo Adding environment variable
$Path = [Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine) + [IO.Path]::PathSeparator + (Get-Location)
[Environment]::SetEnvironmentVariable( "Path", $Path, [System.EnvironmentVariableTarget]::Machine )
echo Success. Press any key.

[Console]::ReadKey()
