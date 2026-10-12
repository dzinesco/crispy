import random
from PIL import Image, ImageDraw, ImageFont
G='/usr/share/fonts/truetype/sand-box/google/'
PS=G+'Press Start 2P/PressStart2P-Regular.ttf'; BU=G+'Bungee/Bungee-Regular.ttf'; VT=G+'VT323/VT323-Regular.ttf'
W,H=1280,800
RED=(178,16,24); DRED=(110,8,14); WHITE=(255,255,255); LG=(200,200,200); MG=(128,128,128); DG=(64,64,64); BK=(8,8,10); PINK=(255,90,100)
posts=[
("tesla-behind-home-assistant","YOUR CAR STAYS HOME","car"),
("home-assistant-bridge-setup","PUT AGENTS BEHIND A BRIDGE","bridge"),
("black-canyon-tickets-automation","CLOSED SYNC LOOP","ticket"),
("billing-service-vs-software","SERVICE vs SOFTWARE","scale"),
("hcpf-provider-ops","PROVIDER OPS CHECKLIST","check"),
("25-years-owned-operated","25 YEARS","star"),
("scheduling-ops-closed-loop","SCHEDULING IS A FACTORY","gear"),
("neoclaim-file-intake","POST FILES, NOT EMAILS","folder"),
("837-reject-patterns","837 REJECT PATTERNS","x"),
("evv-to-claim-pipeline","EVV -> CLAIM","pipe"),
("agent-audited-itself-600-mistake","THE $600 SELF-AUDIT","eye"),
("co-medicaid-billing-without-chaos","BILLING WITHOUT CHAOS","stack"),
]
def font(p,s): return ImageFont.truetype(p,s)
def bevel(d,x0,y0,x1,y1,face=LG,inset=False):
    d.rectangle([x0,y0,x1,y1],fill=face)
    a,b=(WHITE,DG) if not inset else (DG,WHITE)
    for i in range(3):
        d.line([x0+i,y0+i,x1-i,y0+i],fill=a); d.line([x0+i,y0+i,x0+i,y1-i],fill=a)
        d.line([x0+i,y1-i,x1-i,y1-i],fill=b); d.line([x1-i,y0+i,x1-i,y1-i],fill=b)
# pixel icons on 16x16 grid
def px(d,ox,oy,s,rows,cmap):
    for j,r in enumerate(rows):
        for i,c in enumerate(r):
            if c in cmap: d.rectangle([ox+i*s,oy+j*s,ox+i*s+s-1,oy+j*s+s-1],fill=cmap[c])
ICONS={
"car":["................","................",".....RRRRRR.....","....RWWRRWWR....","...RWWWRRWWWR...","..RRRRRRRRRRRR..",".RRRRRRRRRRRRRR.","RRWWRRRRRRRRWWRR","RRWWRRRRRRRRWWRR","RRRRRRRRRRRRRRRR",".DDKKDDDDDDKKDD.","...KKK....KKK...","...KKK....KKK...","................","....W.W..W.W....","................"],
"bridge":["................","..W..........W..","..W..........W..",".WWW........WWW.",".WRW.W....W.WRW.",".WRWW.W..W.WWRW.",".WRW...WW...WRW.",".WRW..W..W..WRW.","RRRRRRRRRRRRRRRR","DDDDDDDDDDDDDDDD",".WRW........WRW.",".WRW..K..K..WRW.",".WRW.K.KK.K.WRW.","KKKKKKKKKKKKKKKK","................","................"],
"ticket":["................","................","RRRRRRRRRRRRRRRR","RWWWWWWRWWWWWWWR","RWRRRRWRWKKKKKWR",".WWWWWWRWWWWWWW.","RWRRRWWRWKKKWWWR","RWWWWWWRWWWWWWWR",".WRRRRWRWKKKKKW.","RWWWWWWRWWWWWWWR","RRRRRRRRRRRRRRRR","................","...WW..WW..WW...","..W..W.....W.W..","...WW..WW..WW...","................"],
"scale":["................",".......WW.......","WWWWWWWWWWWWWWWW",".W.....WW.....W.",".W.....WW.....W.","W.W....WW....W.W","W..W...WW...W..W","RRRRR..WW..DDDDD",".RRR...WW...DDD.",".......WW.......",".......WW.......",".......WW.......","....WWWWWWWW....","...WWWWWWWWWW...","................","................"],
"check":["................",".WWWWWWWWWWWWW..",".W...........W..",".W.RR.WWWWWW.W..",".W.RR........W..",".W...........W..",".W.RR.WWWWWW.W..",".W.RR........W..",".W...........W..",".W.RR.WWWWW..W..",".W.RR........W..",".W...........W..",".W.DD.WWWW...W..",".W.DD........W..",".WWWWWWWWWWWWW..","................"],
"star":[".......RR.......",".......RR.......","......RRRR......","......RWWR......","RRRRRRRWWRRRRRRR",".RRRWWWWWWWWRRR.","..RRRWWWWWWRRR..","...RRRWWWWRRR...","...RRRWWWWRRR...","..RRRRRRRRRRRR..","..RRRRR..RRRRR..",".RRRR......RRRR.",".RRR........RRR.","RR............RR","................","................"],
"gear":["......RRRR......","......RRRR......","..RR.RRRRRR.RR..","..RRRRRRRRRRRR..","...RRRRRRRRRR...","RRRRRRWWWWRRRRRR","RRRRRWKKKKWRRRRR","RRRRRWKKKKWRRRRR","RRRRRWKKKKWRRRRR","RRRRRWKKKKWRRRRR","RRRRRRWWWWRRRRRR","...RRRRRRRRRR...","..RRRRRRRRRRRR..","..RR.RRRRRR.RR..","......RRRR......","......RRRR......"],
"folder":["................","................",".RRRRR..........","RWWWWWR.........","RWWWWWWRRRRRRRR.","RRRRRRRRRRRRRRRR","RWWWWWWWWWWWWWWR","RWDDDDDDDDDDDDWR","RWWWWWWWWWWWWWWR","RWDDDDDDDDDDWWWR","RWWWWWWWWWWWWWWR","RWDDDDDDDWWWWWWR","RWWWWWWWWWWWWWWR","RRRRRRRRRRRRRRRR","................","................"],
"x":["................",".RRR........RRR.",".RRRR......RRRR.","..RRRR....RRRR..","...RRRR..RRRR...","....RRRRRRRR....",".....RRRRRR.....","......RRRR......","......RRRR......",".....RRRRRR.....","....RRRRRRRR....","...RRRR..RRRR...","..RRRR....RRRR..",".RRRR......RRRR.",".RRR........RRR.","................"],
"pipe":["................","................","................","WWWW........RRRR","WKKW........RWWR","WKKWWWWWWWWWRWWR","WKKWRRRRRRRRRWWR","WKKWWWWWWWWWRWWR","WKKW...RR...RWWR","WWWW...RR...RRRR",".......RR.......",".......RD.......","......R..R......",".....D....D.....","................","................"],
"eye":["................","................","................",".....WWWWWW.....","...WWWWWWWWWW...","..WWWWRRRRWWWW..",".WWWWRRKKRRWWWW.","WWWWRRKKKKRRWWWW","WWWWRRKKKKRRWWWW",".WWWWRRKKRRWWWW.","..WWWWRRRRWWWW..","...WWWWWWWWWW...",".....WWWWWW.....","................","................","................"],
"stack":["................","....RRRRRRRR....","...RWWWWWWWWR...","...RRRRRRRRRR...","...RWWWWWWWWR...","...RRRRRRRRRR...","...RWWWWWWWWR...","...RRRRRRRRRR...","...RWWWWWWWWR...","...RRRRRRRRRR...","...RWWWWWWWWR...","...RRRRRRRRRR...","....DDDDDDDD....","................","................","................"],
}
CM={'R':RED,'W':WHITE,'D':MG,'K':DG}
def wrap(d,t,f,maxw):
    words=t.split(); lines=[]; cur=''
    for w in words:
        s=(cur+' '+w).strip()
        if d.textlength(s,font=f)<=maxw: cur=s
        else: lines.append(cur); cur=w
    lines.append(cur); return lines
def make(slug,title,icon,seed):
    rnd=random.Random(seed); im=Image.new('RGB',(W,H),BK); d=ImageDraw.Draw(im)
    for _ in range(420):
        x,y=rnd.randrange(W),rnd.randrange(H); s=rnd.choice([1,1,1,2,2,3]); c=rnd.choice([WHITE,LG,MG,PINK])
        d.rectangle([x,y,x+s-1,y+s-1],fill=c)
    # tiled red diamonds band at bottom
    for x in range(0,W,32):
        d.polygon([(x+16,H-56),(x+32,H-40),(x+16,H-24),(x,H-40)],fill=DRED if (x//32)%2 else RED)
    # window
    x0,y0,x1,y1=70,60,W-70,H-90
    bevel(d,x0,y0,x1,y1)
    d.rectangle([x0+6,y0+6,x1-6,y0+44],fill=DRED)
    for i in range(0,x1-x0-12,4): d.line([x0+6+i,y0+6,x0+6+i,y0+44],fill=RED if (i//4)%3==0 else DRED)
    d.text((x0+18,y0+14),slug[:46]+'.html',font=font(PS,16),fill=WHITE)
    for k,ch in enumerate(['X','[]','_']):
        bx=x1-46-k*40; bevel(d,bx,y0+11,bx+32,y0+39); d.text((bx+16,y0+25),ch,font=font(PS,12),fill=BK,anchor='mm')
    ix0,iy0,ix1,iy1=x0+14,y0+56,x1-14,y1-14
    bevel(d,ix0,iy0,ix1,iy1,face=BK,inset=True)
    for _ in range(160):
        x,y=rnd.randrange(ix0+4,ix1-4),rnd.randrange(iy0+4,iy1-4); d.point((x,y),fill=rnd.choice([WHITE,MG]))
    # icon
    s=18; ox,oy=ix0+50,iy0+60
    bevel(d,ox-16,oy-16,ox+16*s+16,oy+16*s+16,face=DG)
    px(d,ox,oy,s,ICONS[icon],CM)
    # WordArt title
    tx=ox+16*s+70; maxw=ix1-tx-40
    size=84
    while True:
        f=font(BU,size); lines=wrap(d,title,f,maxw)
        if len(lines)*size*1.1<=330 and all(d.textlength(l,font=f)<=maxw for l in lines): break
        size-=4
    ty=oy+ (16*s - len(lines)*size*1.1)/2
    for l in lines:
        for k in range(10,0,-1): d.text((tx+k,ty+k),l,font=f,fill=DRED if k>2 else BK)
        d.text((tx,ty),l,font=f,fill=WHITE,stroke_width=3,stroke_fill=RED)
        ty+=size*1.1
    # under construction strip (red/white hazard)
    sy=iy1-70; sx0,sx1=ix0+40,ix1-40
    strip=Image.new('RGB',(sx1-sx0,40),WHITE); sd=ImageDraw.Draw(strip)
    for i in range(-40,sx1-sx0+40,40): sd.polygon([(i,40),(i+20,40),(i+60,0),(i+40,0)],fill=RED)
    im.paste(strip,(sx0,sy)); d.rectangle([sx0,sy,sx1,sy+39],outline=BK,width=3)
    lab='~ CRISPYGOAT.COM ~ BEST VIEWED AT 800x600 ~'; lf=font(PS,16)
    lw=d.textlength(lab,font=lf); bevel(d,(W-lw)/2-14,sy+4,(W+lw)/2+14,sy+36,face=BK)
    d.text((W/2,sy+20),lab,font=lf,fill=WHITE,anchor='mm')
    # little hit counter
    d.text((x0+4,H-82),'',font=lf)
    im.save(f'public/images/blog/cover-{slug}.webp',quality=88)
    return im
ims=[make(s,t,i,n) for n,(s,t,i) in enumerate(posts)]
tw,th=640,400; pad=20
sheet=Image.new('RGB',(3*tw+4*pad,4*(th+40)+pad),BK); sd=ImageDraw.Draw(sheet)
for n,(im,(s,_,_)) in enumerate(zip(ims,posts)):
    c,r=n%3,n//3; x=pad+c*(tw+pad); y=pad+r*(th+40)
    sheet.paste(im.resize((tw,th),Image.LANCZOS),(x,y)); sd.text((x,y+th+8),s,font=font(VT,26),fill=WHITE)
sheet.save('/tmp/blog-covers-sheet.png')
