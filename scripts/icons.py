# Generate small dependency-free PNG icons matching the SVG's card and sparkle.
import struct,zlib,pathlib
for size in (16,32,48,128):
 rows=[]
 for y in range(size):
  row=b''
  for x in range(size):
   u,v=x*128/size,y*128/size
   color=(21,28,48,255)
   if (35<=u<=44 and 28<=v<=101) or (35<=u<=78 and 28<=v<=37) or (35<=u<=93 and 92<=v<=101) or (84<=u<=93 and 61<=v<=101):color=(160,130,240,255)
   if abs(u-90)/18+abs(v-42)/22<1:color=(103,232,249,255)
   if 52<=u<=75 and (61<=v<=67 or 77<=v<=83):color=(159,141,226,255)
   row+=bytes(color)
  rows.append(b'\0'+row)
 def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
 pathlib.Path(f'public/icons/{size}.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b''))
