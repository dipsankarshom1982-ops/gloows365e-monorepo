DELETE THESE FILES/FOLDERS FIRST (run in PowerShell from C:\GLOOWS365E-MONOREPO):

Remove-Item -Recurse -Force "apps\web\src\app\ai-guru"
Remove-Item -Recurse -Force "apps\web\src\app\wallet"
Remove-Item -Recurse -Force "apps\web\src\app\login"
Remove-Item -Recurse -Force "apps\web\src\app\(auth)\login\register"

THEN place the new files provided.
ALSO CREATE this missing folder:
  apps\web\src\app\(app)\battle\page.tsx  ← provided below
  apps\web\src\app\(auth)\register\page.tsx ← move register here
