import React from 'react';
import { palettes } from '../../design/tokens';
import { worldTemplates, type ViviWorldId } from '../../world/templates';

export function SceneArt({ world, active = false }: { world: ViviWorldId; active?: boolean }) {
  const p = palettes[worldTemplates[world].palette];
  const isExterior = world === 'city_rain' || world === 'neighborhood_sunset' || world === 'train_station';
  const isHall = world === 'hallway_night';
  const isOffice = world === 'office_night';
  const isParty = world === 'bar_or_party';
  const isBedroom = world === 'bedroom_night';
  const isFamily = world === 'family_home';
  const isHotel = world === 'hotel_or_rental';
  const isApartment = world === 'apartment_night';
  return <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className="vivi-scene-art" role="img" aria-label={`Illustrated ${worldTemplates[world].label} scene`}>
    <defs>
      <linearGradient id={`wall-${world}`} x2="0" y2="1"><stop stopColor={p.sky}/><stop offset="1" stopColor={p.wall}/></linearGradient>
      <linearGradient id={`floor-${world}`} x2="0" y2="1"><stop stopColor={p.floor}/><stop offset="1" stopColor={p.shadow}/></linearGradient>
      <radialGradient id={`light-${world}`}><stop stopColor={p.practical} stopOpacity=".55"/><stop offset="1" stopColor={p.practical} stopOpacity="0"/></radialGradient>
      <pattern id="grain-vivi" width="42" height="42" patternUnits="userSpaceOnUse"><circle cx="5" cy="8" r=".6" fill="#fff" opacity=".14"/><circle cx="31" cy="25" r=".8" fill="#111" opacity=".1"/></pattern>
    </defs>
    <rect width="1000" height="600" fill={`url(#wall-${world})`}/>
    {isExterior ? <>
      <path d="M0 295 L140 242 L286 259 L378 212 L486 241 L625 195 L760 241 L897 205 L1000 236 V410 H0Z" fill={p.shadow} opacity=".4"/>
      <path d="M0 380 L1000 348 V600 H0Z" fill={`url(#floor-${world})`}/>
      <path d="M0 488 Q360 414 1000 481" stroke={p.practical} strokeWidth="3" opacity=".22" fill="none"/>
    </> : <>
      <path d="M0 0 H1000 V367 L500 392 L0 360Z" fill={p.wall} opacity=".43"/>
      <path d="M0 357 L500 382 L1000 357 V600 H0Z" fill={`url(#floor-${world})`}/>
      <path d="M0 357 L500 382 L1000 357" stroke={p.practical} strokeWidth="5" opacity=".2" fill="none"/>
      <path d="M500 382 L500 600 M0 480 L1000 480" stroke="#fff" strokeOpacity=".08" strokeWidth="2"/>
    </>}
    {(isApartment || isBedroom || isFamily || isHotel) && <>
      <rect x="115" y="86" width="238" height="211" rx="5" fill={p.shadow} stroke={p.practical} strokeOpacity=".3" strokeWidth="8"/>
      <path d="M235 87 V299 M115 198 H353" stroke={p.wall} strokeWidth="9" opacity=".8"/>
      <path d="M123 289 L344 289 L382 350 L91 350Z" fill={p.practical} opacity=".13"/>
      <rect x="744" y="116" width="158" height="239" fill={p.shadow} stroke={p.practical} strokeOpacity=".38" strokeWidth="7"/>
      <rect x="760" y="132" width="126" height="222" fill={p.sky}/><circle cx="867" cy="246" r="5" fill={p.practical}/>
      {active && <path d="M756 352 Q783 338 806 353" stroke={p.accent} strokeWidth="4" fill="none" opacity=".8"/>}
    </>}
    {(isApartment || isBedroom) && <>
      <ellipse cx="377" cy="504" rx="284" ry="59" fill={p.shadow} opacity=".35"/>
      <path d="M103 438 Q101 404 142 400 H367 Q400 401 401 444 L416 505 H85Z" fill={isBedroom ? '#8a7880' : '#80757d'}/>
      <path d="M114 445 Q240 417 390 448" stroke={p.practical} strokeOpacity=".2" strokeWidth="13" fill="none"/>
      <path d="M452 454 L612 454 L642 493 L425 493Z" fill="#75605c"/><path d="M440 491 L437 542 M630 491 L635 541" stroke={p.shadow} strokeWidth="13"/>
      <rect x="515" y="421" width="29" height="46" rx="4" fill="#2b3940" stroke={p.practical} strokeWidth="2"/>
      {active && <rect x="521" y="426" width="17" height="22" rx="2" fill={p.practical} opacity=".85"/>}
      <circle cx="530" cy="475" r="136" fill={`url(#light-${world})`} opacity=".7"/>
      {isBedroom && <path d="M92 476 Q236 458 402 480 L428 520 Q213 547 80 524Z" fill="#9c8990" opacity=".85"/>}
    </>}
    {(isOffice || isParty) && <>
      <rect x="113" y="101" width="247" height="201" rx="4" fill={isOffice ? '#283f50' : '#5c6460'} stroke={p.practical} strokeOpacity=".35" strokeWidth="8"/>
      {isOffice ? <><path d="M139 263 L139 211 L184 211 L184 232 L237 232 L237 182 L281 182 L281 146 L329 146" fill="none" stroke="#a9c8ca" strokeWidth="7" opacity=".8"/><path d="M408 430 L755 430 L829 515 L352 515Z" fill="#65737a"/><path d="M383 510 L374 575 M797 510 L811 575" stroke={p.shadow} strokeWidth="15"/><rect x="255" y="445" width="68" height="44" rx="5" fill="#263944" stroke="#8fb6bf" strokeWidth="3"/><rect x="824" y="110" width="90" height="66" fill="#223846"/><text x="837" y="151" fill="#d5d8d1" fontFamily="monospace" fontSize="26">10:42</text></> : <><path d="M378 431 L898 431 L921 473 L348 473Z" fill="#726e64"/><path d="M374 472 L360 585 M902 472 L918 585" stroke={p.shadow} strokeWidth="17"/><ellipse cx="260" cy="497" rx="140" ry="31" fill="#696d65"/><path d="M258 500 L258 574" stroke="#555d59" strokeWidth="16"/><circle cx="520" cy="453" r="9" fill="#e7c8a3"/><circle cx="700" cy="453" r="9" fill="#e7c8a3"/></>}
    </>}
    {isHall && <>
      <path d="M0 85 L360 208 V458 L0 600Z M1000 60 L669 208 V458 L1000 600Z" fill={p.shadow} opacity=".55"/>
      <path d="M361 210 H668 V458 H361Z" fill={p.wall} opacity=".4"/>
      <path d="M362 456 L668 456 L1000 600 H0Z" fill={p.floor} opacity=".7"/>
      <rect x="736" y="195" width="169" height="259" fill="#263846" stroke="#a6bbb9" strokeWidth="6"/><path d="M819 199 V454" stroke="#b7c9c7" strokeWidth="3"/>
      <rect x="139" y="176" width="150" height="331" fill="#334551" stroke="#8e9b96" strokeWidth="7"/><circle cx="267" cy="350" r="5" fill={p.practical}/>
      <rect x="318" y="231" width="33" height="52" rx="3" fill="#273944" stroke={p.practical} strokeOpacity=".5" strokeWidth="3"/>
      <rect x="784" y="141" width="72" height="38" rx="3" fill="#22313a"/><text x="813" y="169" fill={p.practical} fontFamily="monospace" fontSize="27">{active ? '9' : '6'}</text>
      <ellipse cx="540" cy="248" rx="192" ry="164" fill={`url(#light-${world})`} opacity=".5"/>
    </>}
    {isFamily && <><path d="M332 448 L641 448 L687 512 L278 512Z" fill="#8c705b"/><path d="M302 507 L295 579 M657 507 L667 579" stroke="#554b42" strokeWidth="14"/><rect x="410" y="428" width="153" height="40" rx="3" fill="#eadcc2" transform="rotate(-7 410 428)"/><rect x="428" y="412" width="149" height="40" rx="3" fill="#e2d1b0" transform="rotate(5 428 412)"/></>}
    {isHotel && <><path d="M440 453 L624 453 L649 489 L415 489Z" fill="#827365"/><rect x="484" y="419" width="78" height="43" fill="#e1d4c0" transform="rotate(-8 484 419)"/><path d="M150 512 L287 512 L301 576 L135 576Z" fill="#6c777c"/></>}
    {world === 'train_station' && <><path d="M0 330 L1000 297" stroke="#ebd4ac" strokeWidth="12"/><path d="M0 421 L1000 385" stroke="#2c4350" strokeWidth="45"/><path d="M560 405 L1000 372 L1000 520 L560 550Z" fill="#89979a"/><path d="M612 421 H960" stroke="#d5ba86" strokeWidth="8"/><rect x="690" y="83" width="224" height="102" rx="3" fill="#263d44" stroke="#d7c6a7" strokeWidth="7"/><text x="714" y="124" fill="#f3e4c8" fontFamily="monospace" fontSize="26">LAST TRAIN</text><text x="714" y="159" fill="#f3e4c8" fontFamily="monospace" fontSize="28">{active ? '00:46' : '00:47'}</text><rect x="175" y="401" width="166" height="15" fill="#83705d"/><path d="M188 413 L179 493 M327 413 L340 493" stroke="#665848" strokeWidth="10"/></>}
    {world === 'city_rain' && <><path d="M102 320 H305 V471 H102Z M402 270 H603 V447 H402Z M727 240 H941 V449 H727Z" fill={p.shadow} opacity=".67"/><path d="M130 353 H275 M430 319 H570 M755 291 H911" stroke={p.practical} strokeWidth="8" opacity=".55"/><path d="M0 548 L1000 480" stroke="#c6b89c" strokeWidth="6" opacity=".5"/>{Array.from({length:35},(_,i)=><path key={i} d={`M${(i*173)%1000} ${(i*79)%600} l-10 29`} stroke="#d7e6e4" strokeOpacity=".25" strokeWidth="2"/>)}</>}
    {world === 'neighborhood_sunset' && <><circle cx="754" cy="152" r="89" fill={p.practical} opacity=".7"/><path d="M0 348 L254 308 L254 426 M310 353 L490 290 L490 417 M550 341 L779 313 L779 411" stroke={p.shadow} strokeWidth="13" opacity=".7" fill="none"/><path d="M0 453 Q400 415 1000 453" stroke="#f0d5a7" strokeWidth="9" opacity=".55" fill="none"/><path d="M169 434 H343 M190 434 L180 490 M324 434 L334 490" stroke="#655c4d" strokeWidth="14"/><rect x="819" y="337" width="107" height="122" fill="#857f70" opacity=".8"/><rect x="800" y="319" width="140" height="12" fill="#eee2c8"/></>}
    <rect width="1000" height="600" fill="url(#grain-vivi)"/>
    <rect width="1000" height="600" fill={p.shadow} opacity=".06"/>
  </svg>;
}
