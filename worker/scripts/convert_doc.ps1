$item = Get-Item -LiteralPath "..\..\plantillas documentos finales\MINUTA_TIPO_TERRITORIUM.doc"
$docPath = $item.FullName
$docxPath = [System.IO.Path]::ChangeExtension($docPath, ".docx")

Write-Output "Resolved path: $docPath"

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $doc = $word.Documents.Open($docPath)
    $doc.SaveAs2($docxPath, 16)
    $doc.Close()
    $word.Quit()
    Write-Output "Successfully converted MINUTA_TIPO_TERRITORIUM.doc to MINUTA_TIPO_TERRITORIUM.docx!"
} catch {
    Write-Output ("Error during conversion: " + $_.Exception.Message)
}
