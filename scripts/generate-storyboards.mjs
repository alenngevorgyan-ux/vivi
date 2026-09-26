/** Deterministic vector storyboard contact sheets. Run: node scripts/generate-storyboards.mjs */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'src/assets/storyboards');
const f = (shot, camera, characters, pose, world, lighting, modifier, control, text, sound, transition) => ({ shot, camera, characters, pose, world, lighting, modifier, control, text, sound, transition });
export const boards = [
  { id:'the-message', title:'THE MESSAGE', palette:['#2b3043','#756071','#e6aa83'], scene:'apartment', frames:[
    f('ESTABLISHING_WIDE','wide · x50 y54','two adults','partner at doorway; player near sofa','phone on table, bathroom visible','amber practical / plum window','none','OFF','“I’m going to shower.”','room tone','cut'),
    f('NPC_EXIT','two person · x61 y55','partner + player','partner turns; player still','bathroom door closes','warm room / dark door','door close','OFF','—','latch','cut'),
    f('STATIC_TENSION','locked · x50 y56','player','idle, facing table','empty room; shower running','amber pool on table','shower starts','ON','—','shower','hold'),
    f('PHONE_INSERT','object · x54 y68','none','—','phone illuminates','cold phone on warm wood','message: I still smell like you','OFF','“I still smell like you.”','vibration','hard cut'),
    f('STATIC_TENSION','locked · x50 y56','player','hesitates','phone remains lit; door closed','practical falls off toward door','typing appears','ON','—','clock tick','hold'),
    f('FOLLOW','soft follow · player','player','may approach, sit, leave or go to door','walkable living room','local light follows silhouette','water stops at 30s','ON','No choice modal','water cuts','player-driven'),
    f('FINAL_COMMIT','locked · selected object','player','selected action posture','phone or doorway dominates frame','compressed contrast','door begins opening','OFF','Commit a physical action','single breath','cut'),
    f('REALITY_REVEAL','reveal hold · x50 y54','player + partner','separated by table','same apartment, later','warm light thins','none','OFF','Author’s account only after commit','silence','fade') ] },
  { id:'0317', title:'03:17', palette:['#203747','#56717a','#cbb991'], scene:'hallway', frames:[
    f('ESTABLISHING_WIDE','wide · x42 y57','one adult','awake by door','clock reads 03:16','cold room / dirty hall','clock','ON','03:16','ventilation','hold'),
    f('OBJECT_INSERT','object · intercom','none','—','intercom fills edge','cyan spill','03:17 ring','OFF','INTERCOM','buzzer','cut'),
    f('OVER_SHOULDER','camera screen · x20 y53','player','leans toward camera','hall camera shows empty landing','screen blue / room dark','camera feed','ON','Nobody there','static','cut'),
    f('FOLLOW','soft follow · player','player','can check peephole, window, phone','door remains closed','cool spill','neighbor message','ON','“Do not come into the hallway.”','phone buzz','player-driven'),
    f('SLOW_PUSH_IN','elevator · x81 y48','none','—','indicator 6 · 7 · 8','emergency amber / cyan seam','arrival','OFF','Floor 9','motor rises','push'),
    f('WIDE_SILENCE','hall wide · x50 y56','player','frozen inside doorway','elevator doors open to empty hall','underlit long sight line','arrival complete','OFF','—','ding then silence','hold'),
    f('OBJECT_INSERT','door handle · x18 y63','none','—','handle moves slightly','tiny red accent on lock','door','OFF','—','metal click','cut'),
    f('FINAL_COMMIT','locked · doorway','player','at chosen location','door still shut','cold edge and warm interior','none','OFF','Commit: open, call, speak, or stay','heartbeat','cut') ] },
  { id:'the-presentation', title:'THE PRESENTATION', palette:['#213b4a','#637681','#dcc293'], scene:'office', frames:[
    f('ESTABLISHING_WIDE','wide · x48 y55','player, coworker, director','seated / presenting / listening','meeting room and screen','monitor cyan / city gold','meeting clock','OFF','Coworker begins','projector fan','cut'),
    f('OVER_SHOULDER','screen · x52 y29','coworker','points at slide','player’s diagram visible','screen cool','slide advance','OFF','This is your work','click','cut'),
    f('OBJECT_INSERT','laptop · x29 y67','player hands','hover over trackpad','dated draft on laptop','screen glow','evidence','ON','The original file is here','keyboard tap','cut'),
    f('TWO_SHOT','director/coworker · x60 y55','director + coworker','director nods; coworker still','approval in progress','warmer on director','praise','OFF','“Excellent work.”','chair creak','cut'),
    f('STATIC_TENSION','locked table · x50 y57','all three','player motionless','clock keeps moving','cool table / gold window','timer','ON','—','projector fan','hold'),
    f('SLOW_PUSH_IN','director · x70 y58','director','looks toward player','room waits','practical on face','ten second window','OFF','“Any questions?”','music stops','push'),
    f('FOLLOW','soft follow · player','player','may stand, open laptop, message, wait','table remains walkable','screen pools','deadline','ON','No immediate menu','clock tick','player-driven'),
    f('FINAL_COMMIT','locked · x50 y57','player','chooses action','screen and director in frame','harder contrast','approval deadline','OFF','Commit before approval','breath','cut') ] },
  { id:'last-walk', title:'LAST WALK', palette:['#ae8778','#c6aa84','#f1d196'], scene:'street', frames:[
    f('ESTABLISHING_WIDE','wide · x50 y56','two adults','walk beside each other','neighborhood street, sunset','honey rim / long shadows','bus arrival','OFF','One walk left','cicadas','dissolve'),
    f('TWO_SHOT','two person · x52 y73','friends','matching pace','bench ahead','soft amber','none','ON','“We should head back.”','footsteps','follow'),
    f('MEMORY_ECHO','float · bench','two child echoes','brief running silhouettes','same bench years earlier','sun faded cream','memory echo','OFF','—','old laughter faint','dissolve'),
    f('OBJECT_INSERT','bag · x70 y68','friend hands','tightens grip','bag and bus ticket','warm hand highlight','arrival board','OFF','—','fabric rustle','cut'),
    f('WIDE_SILENCE','wide · x50 y56','two adults','stop, slightly apart','street opens into negative space','sun lower','bus approaching','ON','No text','cicadas thin','hold'),
    f('FOLLOW','soft follow · player','player','bench, friend, stop, or silence','walkable diagonal path','warm practical at bus stop','time pressure','ON','Choose how to spend the last minute','steps','player-driven'),
    f('NPC_EXIT','wide · stop','friend','turns toward bus','bus enters distant frame','headlights cool','arrival','OFF','—','brakes','cut'),
    f('REALITY_REVEAL','reveal hold · empty bench','none','—','street after departure','honey fades','none','OFF','Author’s goodbye after commit','engine recedes','fade') ] },
];

const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const wrap = (value, max=36) => { const words=String(value).split(' '), lines=[]; let line=''; for(const word of words){ if((line+' '+word).trim().length>max){ lines.push(line); line=word; } else line=(line+' '+word).trim(); } if(line) lines.push(line); return lines.slice(0,3); };
const txt = (lines,x,y,color='#f5eee5',size=12) => lines.map((line,i)=>`<text x="${x}" y="${y+i*(size+4)}" fill="${color}" font-family="Arial,sans-serif" font-size="${size}">${esc(line)}</text>`).join('');
function art(board, frame, x, y, w, h, index){
  const [dark,base,light]=board.palette;
  const sky=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${base}"/>`;
  const floor=`<path d="M${x} ${y+h*.58} L${x+w} ${y+h*.53} V${y+h} H${x}Z" fill="${dark}" opacity=".67"/>`;
  const window=`<rect x="${x+w*.1}" y="${y+h*.14}" width="${w*.26}" height="${h*.3}" fill="${dark}" stroke="${light}" stroke-width="3" opacity=".8"/>`;
  const door=`<rect x="${x+w*.76}" y="${y+h*.18}" width="${w*.16}" height="${h*.42}" fill="${dark}" stroke="${light}" stroke-width="3"/>`;
  const table=`<path d="M${x+w*.37} ${y+h*.65} H${x+w*.72} L${x+w*.77} ${y+h*.72} H${x+w*.32}Z" fill="${light}" opacity=".62"/>`;
  const silhouette=(cx,cy,color,pose='idle')=>`<path d="M${cx-5} ${cy+8} Q${cx} ${cy+5} ${cx+5} ${cy+8} L${cx+8} ${cy+31} L${cx-8} ${cy+31}Z" fill="${color}"/><ellipse cx="${cx}" cy="${cy}" rx="7" ry="9" fill="${color}"/><path d="M${cx-4} ${cy+30} L${cx-(pose==='walk'?11:5)} ${cy+48} M${cx+4} ${cy+30} L${cx+(pose==='walk'?12:5)} ${cy+48}" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
  let scene=sky+floor;
  if(board.scene==='apartment') scene+=window+door+table+`<path d="M${x+w*.08} ${y+h*.67} Q${x+w*.12} ${y+h*.52} ${x+w*.32} ${y+h*.61} L${x+w*.34} ${y+h*.77} H${x+w*.07}Z" fill="${base}" stroke="${light}" stroke-opacity=".5"/>`;
  if(board.scene==='hallway') scene+=`<path d="M${x} ${y} L${x+w*.38} ${y+h*.3} V${y+h*.63} L${x} ${y+h} M${x+w} ${y} L${x+w*.67} ${y+h*.3} V${y+h*.63} L${x+w} ${y+h}" fill="${dark}" opacity=".55"/>`+door+`<rect x="${x+w*.12}" y="${y+h*.37}" width="${w*.1}" height="${h*.12}" fill="${light}" opacity=".65"/>`;
  if(board.scene==='office') scene+=window+table+`<rect x="${x+w*.43}" y="${y+h*.12}" width="${w*.4}" height="${h*.32}" fill="${dark}" stroke="${light}" stroke-width="3"/><path d="M${x+w*.47} ${y+h*.39} L${x+w*.56} ${y+h*.31} L${x+w*.65} ${y+h*.34} L${x+w*.75} ${y+h*.2}" fill="none" stroke="${light}" stroke-width="3"/>`;
  if(board.scene==='street') scene+=`<circle cx="${x+w*.78}" cy="${y+h*.21}" r="${w*.1}" fill="${light}" opacity=".7"/><path d="M${x} ${y+h*.49} L${x+w*.23} ${y+h*.39} L${x+w*.23} ${y+h*.57} M${x+w*.3} ${y+h*.48} L${x+w*.52} ${y+h*.36} L${x+w*.52} ${y+h*.57}" stroke="${dark}" stroke-width="7" fill="none"/>`;
  if(!frame.characters.startsWith('none')) scene+=silhouette(x+w*.36,y+h*.48,'#efe2cd',frame.pose.includes('walk')?'walk':'idle');
  if(frame.characters.includes('two')||frame.characters.includes('+')||frame.characters.includes('friends')||frame.characters.includes('all three')) scene+=silhouette(x+w*.68,y+h*.46,light,'idle');
  if(frame.shot.includes('INSERT')) scene+=`<rect x="${x+w*.31}" y="${y+h*.16}" width="${w*.38}" height="${h*.62}" rx="5" fill="${dark}" stroke="${light}" stroke-width="5" opacity=".93"/><path d="M${x+w*.38} ${y+h*.3} H${x+w*.62} M${x+w*.38} ${y+h*.39} H${x+w*.58}" stroke="${light}" stroke-width="3"/>`;
  scene+=`<rect x="${x+8}" y="${y+8}" width="${w-16}" height="${h-16}" fill="none" stroke="${light}" stroke-opacity=".28"/>`;
  return scene;
}
function render(board){
  const W=1280,H=1120,pw=293,ph=450,gap=18,left=22,top=154;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#eee9df"/><text x="24" y="53" fill="#aa5b48" font-family="Arial,sans-serif" font-size="14" letter-spacing="3">VIVI / CINEMATIC CONTACT SHEET</text><text x="23" y="110" fill="#263137" font-family="Georgia,serif" font-size="50">${board.title}</text><text x="1040" y="108" fill="#aa5b48" font-family="Arial,sans-serif" font-size="14">8 FRAMES · V1</text>`;
  board.frames.forEach((frame,i)=>{const col=i%4,row=Math.floor(i/4),x=left+col*(pw+gap),y=top+row*(ph+gap),artY=y+44,artH=188;
    svg+=`<g><rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="10" fill="#fffaf2" stroke="#d5c9ba"/><text x="${x+16}" y="${y+27}" fill="#a85a47" font-family="Arial,sans-serif" font-weight="bold" font-size="13">${String(i+1).padStart(2,'0')}</text><text x="${x+48}" y="${y+27}" fill="#263137" font-family="Arial,sans-serif" font-weight="bold" font-size="12">${esc(frame.shot)}</text>${art(board,frame,x,artY,pw,artH,i)}`;
    svg+=txt(wrap(frame.text,34),x+16,y+252,'#263137',14);
    const lines=[`CAM ${frame.camera}`,`CAST ${frame.characters} / ${frame.pose}`,`WORLD ${frame.world}`,`LIGHT ${frame.lighting}`,`MOD ${frame.modifier}`,`CTRL ${frame.control} · SFX ${frame.sound}`,`OUT ${frame.transition}`];
    lines.forEach((line,j)=>{svg+=txt([line.length>45 ? `${line.slice(0,43)}…` : line],x+16,y+301+j*19,'#756c63',10)});
    svg+='</g>'; });
  return svg+'</svg>';
}
await mkdir(out,{recursive:true});
for(const board of boards) await writeFile(path.join(out,`${board.id}.svg`),render(board));
