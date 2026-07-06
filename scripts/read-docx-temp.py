import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

path = Path(r"C:\Users\user\Desktop\Документ Microsoft Word (9).docx")
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

with zipfile.ZipFile(path) as z:
    root = ET.fromstring(z.read("word/document.xml"))

paras = []
for para in root.iter(W + "p"):
    parts = []
    for node in para.iter():
        if node.tag == W + "t" and node.text:
            parts.append(node.text)
        elif node.tag == W + "tab":
            parts.append("\t")
    if parts:
        paras.append("".join(parts))

print("\n".join(paras))