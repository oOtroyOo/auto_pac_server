Set WshShell=Wscript.CreateObject("Wscript.Shell")
WshShell.CurrentDirectory=Left(WScript.ScriptFullName,InStrRev(WScript.ScriptFullName,"\"))
WshShell.Run "run.bat", 0