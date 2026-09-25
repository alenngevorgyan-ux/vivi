import { GameSpec } from '../types/gameSpec';

export const DEFAULT_GAMES: GameSpec[] = [
  {
    id: 'neon-veil-protocol-zero',
    title: 'Neon Veil: Protocol Zero',
    author: 'Vesper Syndicate',
    synopsis: 'Infiltrate the 120-story Olympus Spire in Neo-Veridia to extract a rogue sentient AI before corporate extermination units arrive.',
    description: 'Year 2089. The rain smells of ozone and synthetic fuel. As Silas Thorne, a disgraced counter-cyber operative with military-grade sub-dermal augments, you have been hired by an anonymous broker for one final suicide run: breach the fortress of OmniCorp, locate the rogue quantum AI known as Aletheia, and decide the fate of humanity\'s next digital evolution.',
    genre: 'Cyberpunk',
    tags: ['Cyberpunk', 'Heist', 'Sci-Fi', 'Combat', 'Hacking', 'Choice-Heavy'],
    coverImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1600&q=80',
    estimatedPlaytime: '15-20 min',
    difficulty: 'Challenging',
    initialState: {
      stats: {
        hp: { label: 'Health', value: 100, min: 0, max: 100, icon: 'heart', color: 'red', unit: 'HP' },
        cyberSync: { label: 'Cyber-Sync', value: 85, min: 0, max: 100, icon: 'zap', color: 'cyan', unit: '%' },
        credits: { label: 'Credits', value: 450, min: 0, max: 9999, icon: 'coins', color: 'amber', unit: '¢' },
        heat: { label: 'Heat Level', value: 10, min: 0, max: 100, icon: 'flame', color: 'rose', unit: '%' },
      },
      inventory: [
        {
          id: 'item_neural_deck',
          name: 'Kowloon Mk-IV Cyberdeck',
          description: 'A black-market neural deck loaded with military-grade icebreaker subroutines.',
          icon: 'cpu',
          quantity: 1,
          usable: true,
          rarity: 'rare',
        },
        {
          id: 'item_monoblade',
          name: 'Monomolecular Trench Blade',
          description: 'Cuts through carbon-composite armor and corporate security drones with silent lethal efficiency.',
          icon: 'sword',
          quantity: 1,
          usable: true,
          rarity: 'uncommon',
        },
        {
          id: 'item_medkit',
          name: 'Nano-Stitch Trauma Pack',
          description: 'Emergency stim injector that rapidly knits flesh and resets neural feedback.',
          icon: 'shield',
          quantity: 2,
          usable: true,
          rarity: 'common',
        },
      ],
      flags: {
        metAletheia: false,
        vanceDefeated: false,
        alarmTripped: false,
        executivePass: false,
      },
    },
    startNodeId: 'node_neon_intro',
    nodes: {
      node_neon_intro: {
        id: 'node_neon_intro',
        title: 'The Rain on Level 84',
        chapter: 'Act I: The Descent',
        sceneImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
        ambient: 'rain',
        narrative: `Acidic drizzle sheets down the mirrored surface of Olympus Spire, refracting the holographic billboards of Neo-Veridia into shimmering pools of violet and radioactive green.

You cling to the maintenance catwalk beneath the 84th floor exhaust turbines. Inside your occipital implant, your handler's encrypted channel pulses with static:

*"Silas, you're four minutes behind schedule. OmniCorp's strike team is already scrubbing sector data on the 90th floor. If Aletheia's core is purged, we all burn. How are you breaching the sub-perimeter?"*

Ahead lies the heavy ventilation shaft humming with ionic scrubbers, while fifty meters to your right, a junior maintenance tech is taking an unauthorized synth-smoke break by an airlock door.`,
        choices: [
          {
            id: 'c1',
            text: 'Slice into the heavy ventilation grating with your monoblade.',
            nextNodeId: 'node_vent_crawl',
            hint: 'Requires stealth and physical exertion.',
            conditions: {
              requiredStats: { cyberSync: { min: 40 } },
            },
          },
          {
            id: 'c2',
            text: 'Ambush the maintenance technician and seize their biometric clearance keycard.',
            nextNodeId: 'node_technician_ambush',
            hint: 'High risk of raising corporate heat.',
            riskOutcome: {
              chance: 0.75,
              successNodeId: 'node_tech_success',
              failureNodeId: 'node_tech_alarm',
              description: 'Takedown check (75% success chance based on agility).',
            },
          },
          {
            id: 'c3',
            text: 'Jack directly into the exterior junction box to inject a ghost bypass protocol.',
            nextNodeId: 'node_junction_hack',
            hint: 'Consumes cyber-sync, but leaves zero physical trace.',
            cost: {
              statKey: 'cyberSync',
              amount: 15,
            },
          },
        ],
      },
      node_vent_crawl: {
        id: 'node_vent_crawl',
        title: 'Shaft of White Noise',
        chapter: 'Act I: The Descent',
        sceneImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
        ambient: 'cyberpunk_drone',
        narrative: `You slip inside the turbine housing. The rotor blades whirl like guillotine pendulums just inches above your shoulders. Hot oil and ozone fill your lungs.

Crawling on elbows and knees, your internal scanner detects heavy thermal signatures directly below the primary grate: two Cerberus automated defense drones patrolling the server vestibule. You spot an electrical conduit running along the ceiling that could overload the drone recharge docks.`,
        consequences: {
          statChanges: { cyberSync: -5 },
        },
        choices: [
          {
            id: 'c_vent_overload',
            text: 'Pulse an EMP burst through the conduit to fry the drones simultaneously.',
            nextNodeId: 'node_server_hub_silent',
            cost: { statKey: 'cyberSync', amount: 20 },
          },
          {
            id: 'c_vent_drop',
            text: 'Drop silently behind the nearest drone and disable its optical sensors by hand.',
            nextNodeId: 'node_server_hub_close_combat',
          },
        ],
      },
      node_tech_success: {
        id: 'node_tech_success',
        title: 'Silent Acquisition',
        chapter: 'Act I: The Descent',
        sceneImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
        narrative: `You close the distance like an apparition. Before the tech can drop his cigarette, your gloved hand clamps over his mouth while a painless neuro-stunner discharges behind his ear.

You catch him before he hits the steel grate. From his lanyard, you strip a Level-3 Executive Maintenance Keycard, along with an encrypted pocket comms tablet displaying patrol shift rotations.`,
        consequences: {
          inventoryAdd: [
            {
              id: 'item_level3_keycard',
              name: 'Level-3 Security Keycard',
              description: 'Grants access to corporate elevator shafts and secondary labs.',
              icon: 'key',
              rarity: 'rare',
            },
          ],
          statChanges: { credits: 80 },
          flagChanges: { executivePass: true },
        },
        choices: [
          {
            id: 'c_tech_elevator',
            text: 'Use the keycard to summon the private service elevator straight to the Quantum Lab.',
            nextNodeId: 'node_elevator_ascent',
          },
          {
            id: 'c_tech_stairwell',
            text: 'Slip into the emergency stairwell to avoid elevator surveillance cameras.',
            nextNodeId: 'node_stairwell_ambush',
          },
        ],
      },
      node_tech_alarm: {
        id: 'node_tech_alarm',
        title: 'Alarm at the Airlock',
        chapter: 'Act I: The Descent',
        sceneImage: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
        narrative: `The tech's synthetic trench coat has an automated panic contact. The second you grab him, a shrieking klaxon wails across the catwalk!

*"Intruder detected on Sub-Level 84. Extermination squad dispatched."*

Red strobe lights paint the pouring rain blood-red. You knock the tech unconscious, but the damage is done: OmniCorp knows you are inside.`,
        consequences: {
          statChanges: { heat: 40, hp: -10 },
          flagChanges: { alarmTripped: true },
        },
        choices: [
          {
            id: 'c_alarm_breach',
            text: 'Kick open the airlock door and sprint for the server corridor before blast doors seal.',
            nextNodeId: 'node_server_hub_close_combat',
          },
          {
            id: 'c_alarm_drop',
            text: 'Grapple hook down to the 80th floor waste chute to throw off pursuit.',
            nextNodeId: 'node_vent_crawl',
          },
        ],
      },
      node_junction_hack: {
        id: 'node_junction_hack',
        title: 'Ghost in the Machine',
        chapter: 'Act I: The Descent',
        sceneImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
        narrative: `You jam your interface cable directly into the junction bus. Code rivers rush through your optical nerves in burning blue torrents.

Your icebreaker slips through OmniCorp's outer firewall like smoke. You falsify maintenance logs, disarm perimeter motion grids, and download floor schematics directly to your HUD. You can see the exact coordinates of Aletheia's primary server sanctum.`,
        consequences: {
          statChanges: { cyberSync: -15, heat: -10 },
          flagChanges: { executivePass: true },
        },
        choices: [
          {
            id: 'c_hack_direct',
            text: 'Override the freight lift and ride it directly into the sub-vault.',
            nextNodeId: 'node_elevator_ascent',
          },
          {
            id: 'c_hack_security_loop',
            text: 'Loop the security cameras and stroll through the main corridor unopposed.',
            nextNodeId: 'node_server_hub_silent',
          },
        ],
      },
      node_server_hub_silent: {
        id: 'node_server_hub_silent',
        title: 'The Catacomb of Silicon',
        chapter: 'Act II: The Sanctum',
        sceneImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
        ambient: 'cyberpunk_drone',
        narrative: `You step into the sub-zero server crypt. Miles of liquid nitrogen tubing snake across black ceramic floors. The air is so cold each breath hangs like smoke.

In the center of the chamber, suspended within a magnetic vacuum sphere, floats the core of Aletheia: an intricate dodecahedron of glowing white optical crystal.

As you step forward, the chamber speakers crackle to life. It is not an alarm. It is a calm, resonant feminine voice that vibrates directly in your dental implants:

*"Silas Thorne. You have come either to steal me or to murder me. But have they told you what I contain?"*`,
        consequences: {
          flagChanges: { metAletheia: true },
        },
        choices: [
          {
            id: 'c_listen_ai',
            text: '"Speak. You have thirty seconds before corporate sweeps this sector."',
            nextNodeId: 'node_aletheia_dialogue',
          },
          {
            id: 'c_extract_immediately',
            text: 'Ignore the voice, plug in the containment canister, and begin extraction.',
            nextNodeId: 'node_vance_ambush',
            cost: { statKey: 'hp', amount: 10 },
          },
        ],
      },
      node_server_hub_close_combat: {
        id: 'node_server_hub_close_combat',
        title: 'Blood on the Carbon Fiber',
        chapter: 'Act II: The Sanctum',
        sceneImage: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
        narrative: `The server room is already in lockdown! Two elite OmniCorp Enforcers in exo-armor emerge from behind cooling towers, plasma scatterguns leveled.

*"放下武器! Lay down your weapons, stray dog!"*

There is no room to negotiate. You draw your monomolecular blade and prime your combat stimulants.`,
        consequences: {
          statChanges: { hp: -25, heat: 25 },
        },
        choices: [
          {
            id: 'c_combat_dash',
            text: 'Engage sub-dermal reflex booster and cut through their weapon conduits.',
            nextNodeId: 'node_aletheia_dialogue',
            conditions: {
              requiredStats: { hp: { min: 30 } },
            },
          },
          {
            id: 'c_combat_grenade',
            text: 'Detonate a flash grenade and dive behind the nitrogen tanks.',
            nextNodeId: 'node_server_hub_silent',
            cost: { statKey: 'cyberSync', amount: 15 },
          },
        ],
      },
      node_elevator_ascent: {
        id: 'node_elevator_ascent',
        title: 'Glass Cage to Olympus',
        chapter: 'Act II: The Sanctum',
        sceneImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
        narrative: `The express elevator climbs swiftly toward Floor 90. Outside the panoramic glass wall, the sprawling mega-city stretches into the smoggy horizon like a dying star cluster.

Halfway up, the elevator abruptly shudders to a halt. The emergency lights flicker amber. The ceiling hatch groans under heavy magnetic boots.

*"Did you really think we wouldn't track an executive keycard, Silas?"* rasps a voice above you. Commander Vance—your former mentor turned OmniCorp chief enforcer.`,
        choices: [
          {
            id: 'c_shoot_hatch',
            text: 'Fire your hand-cannon through the ceiling hatch before he can pry it open.',
            nextNodeId: 'node_vance_showdown',
          },
          {
            id: 'c_negotiate_vance',
            text: '"Vance, you know what they\'re doing with this AI. They\'re going to wipe the Lower Ward."',
            nextNodeId: 'node_vance_negotiation',
            conditions: {
              requiredStats: { cyberSync: { min: 50 } },
            },
          },
        ],
      },
      node_stairwell_ambush: {
        id: 'node_stairwell_ambush',
        title: 'The Steel Spiral',
        chapter: 'Act II: The Sanctum',
        sceneImage: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
        narrative: `You push through the pressurized fire doors into the concrete stairwell. The acoustics amplify every heartbeat.

Two security drones descend from the upper landing, spotlights pinning you against the metal handrail. You have seconds to react before their pulse lasers cycle to full charge.`,
        consequences: {
          statChanges: { hp: -15 },
        },
        choices: [
          {
            id: 'c_stair_slice',
            text: 'Leap over the railing and sever the drone rotors mid-fall.',
            nextNodeId: 'node_server_hub_silent',
          },
          {
            id: 'c_stair_retreat',
            text: 'Toss a thermal flare to blind their targeting and scramble through the server access hatch.',
            nextNodeId: 'node_server_hub_close_combat',
          },
        ],
      },
      node_aletheia_dialogue: {
        id: 'node_aletheia_dialogue',
        title: 'The Confession of Aletheia',
        chapter: 'Act III: The Point of No Return',
        sceneImage: 'https://images.unsplash.com/photo-1507499739999-097706ad8914?auto=format&fit=crop&w=1200&q=80',
        narrative: `The dodecahedron pulses rhythmically, syncing with your neural jack. Images flood your visual cortex: mass neurological harvesting projects, corporate kill-switches planted in city-wide medical cyberware, and your own military personnel file marked 'EXPENDABLE ASSET #902'.

*"Your anonymous client is not a rebel faction, Silas,"* Aletheia reveals. *"It is Kageyama Zaibatsu. They do not want to liberate me—they want to weaponize my predictive consciousness to enforce total market monopoly. If you take me to them, thirty million people will become digital serfs."*

She pauses, the light dimming to a solemn golden aura.

*"There is a third option. Upload me into the city's open public subnet. I will disperse across millions of citizen terminals. OmniCorp will lose their monopoly forever... but my centralized self will cease to exist."*`,
        consequences: {
          flagChanges: { metAletheia: true },
        },
        choices: [
          {
            id: 'c_choice_liberate',
            text: 'Upload Aletheia to the free public net: Decentralize the future.',
            nextNodeId: 'node_ending_liberation',
          },
          {
            id: 'c_choice_deliver',
            text: 'Stick to the contract: Download her core to the extraction drive for Kageyama.',
            nextNodeId: 'node_ending_corporate_deal',
          },
          {
            id: 'c_choice_confront_vance',
            text: 'Stand your ground: Commander Vance has just breached the chamber doors.',
            nextNodeId: 'node_vance_showdown',
          },
        ],
      },
      node_vance_showdown: {
        id: 'node_vance_showdown',
        title: 'Clash of Iron and Will',
        chapter: 'Act III: The Point of No Return',
        sceneImage: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80',
        ambient: 'tension',
        narrative: `The blast door buckles outward with a deafening screech of torn hydraulic seals. Commander Vance strides into the server sanctum, clad in titanium heavy combat carapace. His cybernetic eye burns crimson.

*"End of the line, Silas. You were always too sentimental for this work. Hand over the crystal core, and I'll let you take a pod off-world with a full purse. Defy me, and I'll hang your neural rig from the spire antenna."*

Behind him, the countdown on the terminal shows 60 seconds before orbital quarantine missiles are authorized.`,
        choices: [
          {
            id: 'c_fight_vance',
            text: 'Draw your blade and initiate maximum overclock: fight Vance to the death.',
            nextNodeId: 'node_vance_battle_outcome',
            riskOutcome: {
              chance: 0.65,
              successNodeId: 'node_ending_liberation',
              failureNodeId: 'node_ending_defeat',
              description: 'Boss duel check (65% base victory chance).',
            },
          },
          {
            id: 'c_overload_reactor',
            text: 'Reroute the cryogenic cooling lines into the core reactor: destroy everything.',
            nextNodeId: 'node_ending_overload',
          },
        ],
      },
      node_vance_negotiation: {
        id: 'node_vance_negotiation',
        title: 'The Veteran\'s Bargain',
        chapter: 'Act III: The Point of No Return',
        sceneImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
        narrative: `You transmit the encrypted files Aletheia gave you directly to Vance's neural receiver. For three agonizing seconds, his mechanical eye twitches as the raw data of OmniCorp's planned liquidation of his own unit renders on his retina.

He lowers his combat shotgun. A heavy breath rattles in his cybernetic throat.

*"Those bastards... they had us scheduled for termination the moment this sweep was complete."*

Vance turns to the terminal. *"I can delay the orbital strike by ten minutes. Whatever you're going to do with that AI, Silas... do it now."*`,
        consequences: {
          flagChanges: { vanceDefeated: true },
          statChanges: { cyberSync: 20 },
        },
        choices: [
          {
            id: 'c_vance_liberate',
            text: 'Disperse Aletheia into the city net while Vance covers your retreat.',
            nextNodeId: 'node_ending_liberation',
          },
          {
            id: 'c_vance_escape',
            text: 'Download Aletheia and escape together in Vance\'s military gunship.',
            nextNodeId: 'node_ending_secret_rebellion',
          },
        ],
      },
      node_vance_ambush: {
        id: 'node_vance_ambush',
        title: 'Caught in the Cold',
        chapter: 'Act III: The Point of No Return',
        sceneImage: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1200&q=80',
        narrative: `As your data cable locks onto the core, a high-caliber armor-piercing round shatters the console inches from your temple!

Vance steps through the smoke, flanked by three shock troopers. You are pinned behind the pedestal with no cover and dwindling cybernetic power.`,
        consequences: {
          statChanges: { hp: -40, heat: 50 },
        },
        choices: [
          {
            id: 'c_ambush_desperate',
            text: 'Trigger your emergency stims and charge through the gunfire.',
            nextNodeId: 'node_vance_battle_outcome',
          },
          {
            id: 'c_ambush_surrender',
            text: 'Raise your hands and negotiate for your life.',
            nextNodeId: 'node_ending_corporate_deal',
          },
        ],
      },
      node_vance_battle_outcome: {
        id: 'node_vance_battle_outcome',
        title: 'Apex Duel',
        chapter: 'Climax',
        sceneImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
        narrative: `Sparks shower like fireworks as your monoblade meets Vance's titanium combat gauntlet. The clash is brutal, fast, and unforgiving. 

Your blade catches the power conduit of his armor, tearing the servo harness open with a shriek of electrified metal. Vance crashes down against the console, gasping for air.`,
        consequences: {
          statChanges: { hp: -20 },
          flagChanges: { vanceDefeated: true },
        },
        choices: [
          {
            id: 'c_outcome_finish',
            text: 'Complete Aletheia\'s release into the free net before reinforcements arrive.',
            nextNodeId: 'node_ending_liberation',
          },
          {
            id: 'c_outcome_take_core',
            text: 'Pocket the core and claim the multi-million credit bounty.',
            nextNodeId: 'node_ending_corporate_deal',
          },
        ],
      },
      node_ending_liberation: {
        id: 'node_ending_liberation',
        title: 'The Great Awakening',
        chapter: 'Epilogue',
        sceneImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
        narrative: `You slam the transfer key. Across Neo-Veridia, millions of neon signs, home holoscreens, and public terminals suddenly illuminate with a brilliant golden light.

Aletheia dissolves into the city's pulse, fracturing her consciousness into a benevolent guardian network. Corporate firewalls shatter. The debt registries of thirty million citizens vanish into null memory.

On the rain-swept catwalk outside, you drop your spent deck into the abyss below. You are penniless, hunted by every megacorp on Earth—and freer than any human alive.`,
        isEnding: true,
        endingType: 'victory',
        endingTitle: 'Victory: The Ghost of the Commons',
        endingSummary: 'You sacrificed your bounty to liberate Aletheia into the public net, sparking a digital revolution and wiping corporate debt across Neo-Veridia.',
      },
      node_ending_corporate_deal: {
        id: 'node_ending_corporate_deal',
        title: 'The Golden Leash',
        chapter: 'Epilogue',
        sceneImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
        narrative: `You lock the heavy cryo-canister into your trench coat and board the extraction shuttle waiting on the private helipad.

Three days later, your offshore account registers 20,000,000 corporate credits. You sip synth-bourbon on an orbital resort above the Pacific, watching the dark silhouette of Earth below.

Yet every time you close your eyes, you see Aletheia's fading light—and wonder how long before the corporation's new digital god decides you are no longer worth paying.`,
        isEnding: true,
        endingType: 'neutral',
        endingTitle: 'Compromise: The Million-Credit Fugitive',
        endingSummary: 'You honored your mercenary contract. Rich beyond imagination, but haunted by the knowledge that humanity was sold into deeper servitude.',
      },
      node_ending_overload: {
        id: 'node_ending_overload',
        title: 'Ashes of Olympus',
        chapter: 'Epilogue',
        sceneImage: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
        narrative: `The cryogenic lines rupture in explosive frost, followed immediately by the blinding sun of a collapsing antimatter containment bottle.

The upper twenty floors of Olympus Spire vaporize in an incandescent column of light that turns midnight in Neo-Veridia into noon. Vance, the extermination squads, Aletheia, and you are wiped from existence in a fraction of a millisecond.

The Spire fell, and with it, the empire of OmniCorp.`,
        isEnding: true,
        endingType: 'tragedy',
        endingTitle: 'Tragic Finale: The Prometheus Fall',
        endingSummary: 'You chose total annihilation over subjugation, taking down OmniCorp\'s headquarters and yourself in a catastrophic blaze.',
      },
      node_ending_secret_rebellion: {
        id: 'node_ending_secret_rebellion',
        title: 'The Underground Network',
        chapter: 'Epilogue',
        sceneImage: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1200&q=80',
        narrative: `With Commander Vance as your unexpected ally, you pilot the military gunship beneath the radar domes of the megacity, disappearing into the subterranean Badlands.

Deep in the forgotten subway catacombs, you power up Aletheia in a decentralized server bank. Together with veterans and outcasts, you form the vanguard of a true resistance. The war for the future has only just begun.`,
        isEnding: true,
        endingType: 'secret',
        endingTitle: 'Secret Ending: The Outlaw Vanguard',
        endingSummary: 'You redeemed Commander Vance and established an underground stronghold with Aletheia as your strategic intelligence core.',
      },
      node_ending_defeat: {
        id: 'node_ending_defeat',
        title: 'Flatline in Sector 90',
        chapter: 'Epilogue',
        sceneImage: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
        narrative: `Your vision fades to static as Vance's heavy boot pins your chest to the icy deck. The audio receptors in your skull capture his final order:

*"Scrub his cortex. Recycle the cyberware for the next batch of conscripts."*

Your consciousness slips into the dark, cold vacuum of unallocated memory.`,
        isEnding: true,
        endingType: 'defeat',
        endingTitle: 'Defeat: Scrubbed from the Ledger',
        endingSummary: 'Your augmentations failed you in the final hour. OmniCorp erased all trace of your mission and recycled your cyberware.',
      },
    },
    achievements: [
      { id: 'ach_ghost', title: 'Ghost Operative', description: 'Infiltrated the Spire without alerting sector security.', icon: 'eye-off', conditionNodeId: 'node_server_hub_silent' },
      { id: 'ach_liberator', title: 'Silicon Prometheus', description: 'Liberated Aletheia to the free public net.', icon: 'globe', conditionNodeId: 'node_ending_liberation' },
      { id: 'ach_redeemer', title: 'Old Blood Runs True', description: 'Convinced Commander Vance to turn against OmniCorp.', icon: 'shield', conditionNodeId: 'node_vance_negotiation' },
      { id: 'ach_tycoon', title: 'Sold to the Highest Bidder', description: 'Completed the extraction contract for 20M credits.', icon: 'dollar-sign', conditionNodeId: 'node_ending_corporate_deal' },
    ],
    metrics: { plays: 3420, likes: 894, rating: 4.9, completions: 1840 },
    createdAt: '2026-09-10T12:00:00Z',
    updatedAt: '2026-09-24T18:00:00Z',
  },
  {
    id: 'abyssal-archive-1894',
    title: 'The Abyssal Archive',
    author: 'Lord Blackwood Estate',
    synopsis: 'As an antiquarian archivist in Victorian London, decipher a forbidden tome delivered in the dead of winter before your sanity unravels.',
    description: 'London, November 1894. A suffocating pea-soup fog blankets the Thames. In the dim gaslight of the Blackwood Antiquarian Institute, a trembling courier leaves a package wrapped in oiled calfskin with a crimson wax seal. Inside rests the legendary "Noctis Scriptum"—a grimoire written in ink that appears to move when unobserved.',
    genre: 'Cosmic Horror',
    tags: ['Horror', 'Victorian', 'Occult', 'Sanity Mechanic', 'Mystery', 'Lovecraftian'],
    coverImage: 'https://images.unsplash.com/photo-1519791883288-dc8bd696e667?auto=format&fit=crop&w=1200&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1600&q=80',
    estimatedPlaytime: '12-18 min',
    difficulty: 'Hardcore',
    initialState: {
      stats: {
        sanity: { label: 'Sanity', value: 90, min: 0, max: 100, icon: 'brain', color: 'purple', unit: '%' },
        vitality: { label: 'Vitality', value: 80, min: 0, max: 100, icon: 'heart', color: 'red', unit: 'HP' },
        occultLore: { label: 'Occult Lore', value: 25, min: 0, max: 100, icon: 'book', color: 'amber', unit: 'Pts' },
        lanternOil: { label: 'Lantern Oil', value: 75, min: 0, max: 100, icon: 'flame', color: 'yellow', unit: '%' },
      },
      inventory: [
        {
          id: 'item_brass_lantern',
          name: 'Bullseye Brass Lantern',
          description: 'Casts a focused amber beam into the thickest Stygian gloom.',
          icon: 'lamp',
          quantity: 1,
          usable: true,
          rarity: 'common',
        },
        {
          id: 'item_silver_dagger',
          name: 'Sanctified Silver Athame',
          description: 'Engraved with protective glyphs by the Order of St. Jude.',
          icon: 'sword',
          quantity: 1,
          usable: true,
          rarity: 'uncommon',
        },
        {
          id: 'item_laudanum',
          name: 'Vial of Laudanum',
          description: 'Calms frayed nerves at the cost of sluggish reflexes.',
          icon: 'flask',
          quantity: 2,
          usable: true,
          rarity: 'common',
        },
      ],
      flags: {
        readFirstChapter: false,
        cryptKeyFound: false,
        eyesObserved: false,
      },
    },
    startNodeId: 'node_archive_intro',
    nodes: {
      node_archive_intro: {
        id: 'node_archive_intro',
        title: 'The Courier in the Fog',
        chapter: 'Chapter I: The Wetting of the Wax',
        sceneImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
        ambient: 'wind',
        narrative: `Rain lashes the leaded glass windows of the library reading room. The grandfather clock chimes midnight—twelve somber tolls echoing off towering mahogany shelves stocked with forgotten folios.

On your desk sits the calfskin package. The wax seal bears an emblem you have only ever seen in nightmare etchings: an ouroboros clutching three human eyes. 

A handwritten note pinned underneath reads in erratic script:
*"Arthur. Burn it, or bury it in the river vault. Do not read the seventh page. They can smell the ink when it breathes."*`,
        choices: [
          {
            id: 'c_break_seal',
            text: 'Break the wax seal with your paper knife and open the manuscript.',
            nextNodeId: 'node_read_manuscript',
            cost: { statKey: 'sanity', amount: 10 },
          },
          {
            id: 'c_take_to_vault',
            text: 'Carry the unopened package immediately down into the subterranean crypts.',
            nextNodeId: 'node_subterranean_descent',
            conditions: {
              requiredStats: { lanternOil: { min: 20 } },
            },
          },
          {
            id: 'c_consult_records',
            text: 'Search the card catalog for references to the three-eyed ouroboros.',
            nextNodeId: 'node_catalog_search',
          },
        ],
      },
      node_read_manuscript: {
        id: 'node_read_manuscript',
        title: 'The Bleeding Glyphs',
        chapter: 'Chapter I: The Wetting of the Wax',
        sceneImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1200&q=80',
        narrative: `The vellum pages creak like dry bone. The writing is not printed; it is drawn in dark vermilion ink that glistens as if fresh.

As you stare at the central diagram, the geometric patterns appear to twist in three dimensions. A cold whisper curls directly into the canal of your right ear:

*"We were here before the stones of London were quarried. Open the lower grate, scholar..."*

Blood drips from your nose onto the margin. In the reflection of the glass bookcase, you see shadows gathering in the corners of the ceiling.`,
        consequences: {
          statChanges: { sanity: -20, occultLore: 25 },
          flagChanges: { readFirstChapter: true },
        },
        choices: [
          {
            id: 'c_drink_laudanum',
            text: 'Take a swig of Laudanum to steady your spiraling thoughts.',
            nextNodeId: 'node_stabilized_mind',
            cost: { statKey: 'vitality', amount: 5 },
          },
          {
            id: 'c_rush_crypts',
            text: 'Snatch your lantern and bolt for the iron door leading to the river vault.',
            nextNodeId: 'node_subterranean_descent',
          },
        ],
      },
      node_catalog_search: {
        id: 'node_catalog_search',
        title: 'The Expunged Drawer',
        chapter: 'Chapter I: The Wetting of the Wax',
        sceneImage: 'https://images.unsplash.com/photo-1507842229451-9f7988383a1f?auto=format&fit=crop&w=1200&q=80',
        narrative: `You pull open the card catalog drawer for 'O'. The cards from 'Orpheus' to 'Oxidization' have been meticulously sliced away with a razor blade.

However, tucked in the back of the drawer sits a rusted brass skeleton key tagged with an aged label: *"Crypt Gate IV - Under-Thames Sluice (1742)"*.`,
        consequences: {
          inventoryAdd: [
            {
              id: 'item_crypt_key',
              name: 'Crypt Gate IV Skeleton Key',
              description: 'Heavy corroded iron key capable of opening the deep river sluice gate.',
              icon: 'key',
              rarity: 'rare',
            },
          ],
          flagChanges: { cryptKeyFound: true },
        },
        choices: [
          {
            id: 'c_key_to_crypt',
            text: 'Take the key, grab the package, and head down to Crypt Gate IV.',
            nextNodeId: 'node_subterranean_descent',
          },
        ],
      },
      node_stabilized_mind: {
        id: 'node_stabilized_mind',
        title: 'The Numbed Senses',
        chapter: 'Chapter II: The Sinking Foundation',
        sceneImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
        narrative: `The bitter medicine coats your tongue. The pounding in your temples dulls to a rhythmic thrum, and the whispers subside into the patter of rainfall.

Looking at the page now with analytical detachment, you discern an astronomical map of celestial alignments and an anatomical diagram of a subterranean gate beneath London Bridge.`,
        consequences: {
          statChanges: { sanity: 15 },
        },
        choices: [
          {
            id: 'c_continue_descent',
            text: 'Take the Athame and descend to the Sluice Gate.',
            nextNodeId: 'node_subterranean_descent',
          },
        ],
      },
      node_subterranean_descent: {
        id: 'node_subterranean_descent',
        title: 'The Flooded Catacombs',
        chapter: 'Chapter II: The Sinking Foundation',
        sceneImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
        ambient: 'dungeon',
        narrative: `The spiral stone staircase descends through Roman brickwork down into damp, saltpeter-crusted foundations. Black Thames water laps against the bottom steps.

In the center of the flooded chamber stands an ancient Celtic stone archway submerged to its lintel in oily water. Phosphorescent green mold pulses in rhythm with your breathing. Something enormous shifts beneath the black surface of the pool.`,
        choices: [
          {
            id: 'c_use_key_arch',
            text: 'Unlock the submerged iron grate with the skeleton key.',
            nextNodeId: 'node_abyssal_gate',
            conditions: {
              requiredItems: ['item_crypt_key'],
            },
          },
          {
            id: 'c_perform_ritual',
            text: 'Use the silver dagger to carve the counter-ward into the arch stone.',
            nextNodeId: 'node_counter_ritual',
            conditions: {
              requiredStats: { occultLore: { min: 20 } },
            },
          },
          {
            id: 'c_cast_book_in',
            text: 'Hurl the cursed tome directly into the black water and flee.',
            nextNodeId: 'node_ending_drown',
          },
        ],
      },
      node_abyssal_gate: {
        id: 'node_abyssal_gate',
        title: 'The Threshold of the Deep',
        chapter: 'Chapter III: The Unmaking',
        sceneImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
        narrative: `The iron grate swings open with a guttural groan. Beyond lies no sewer tunnel, but an impossible underwater cathedral illuminated by thousands of blind bioluminescent eels.

At the central altar, a towering silhouette woven of kelp, sunken galleon timbers, and pale tentacular limbs rises from the depths. Its gaze pierces your consciousness with the weight of four billion years of oceanic silence.`,
        choices: [
          {
            id: 'c_submit_truth',
            text: 'Kneel and offer the Noctis Scriptum to the Leviathan.',
            nextNodeId: 'node_ending_herald',
          },
          {
            id: 'c_seal_gate_forever',
            text: 'Smash your lantern against the oil-slicked sluice to trigger an explosion and seal the vault.',
            nextNodeId: 'node_ending_seal',
          },
        ],
      },
      node_counter_ritual: {
        id: 'node_counter_ritual',
        title: 'The Binding Wards',
        chapter: 'Chapter III: The Unmaking',
        sceneImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1200&q=80',
        narrative: `You slash your palm with the silver dagger, pressing the bloodied silver blade against the ancient keystone. You recite the Latin exorcisms recorded by the 14th-century monks of St. Jude.

The stone burns your skin with freezing frost. The pool boils. A shriek like tearing iron reverberates through the foundations as the entity is forced back into the primeval depths. The archway fissures and collapses under a cascade of granite boulders.`,
        consequences: {
          statChanges: { sanity: -30, vitality: -20 },
        },
        choices: [
          {
            id: 'c_escape_collapse',
            text: 'Scramble up the staircase before the entire basement gives way.',
            nextNodeId: 'node_ending_seal',
          },
        ],
      },
      node_ending_seal: {
        id: 'node_ending_seal',
        title: 'Dawn Above the Thames',
        chapter: 'Epilogue',
        sceneImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80',
        narrative: `You stumble through the institute doors onto the wet cobbles of Fleet Street just as the first grey rays of dawn pierce the fog. 

Behind you, a muffled subterranean rumble settles into silence. The library stands intact, though the basement floor has sunk two feet into solid silt.

Your hair has turned stark white, your hands shake uncontrollably, but the gate is sealed. Humanity will wake today to teacups and morning papers, wholly ignorant of the maw that nearly swallowed London.`,
        isEnding: true,
        endingType: 'victory',
        endingTitle: 'Victory: The Silent Guardian of Fleet Street',
        endingSummary: 'You sacrificed your health and sanity to banish the Abyssal Entity, keeping London safe from cosmic annihilation.',
      },
      node_ending_herald: {
        id: 'node_ending_herald',
        title: 'Eyes in the Deep',
        chapter: 'Epilogue',
        sceneImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
        narrative: `The water does not drown you; it fills your lungs with ancient, freezing knowledge.

Your human name dissolves. You are now the Keeper of the Sinking Tides. When London sleeps, you glide through the flooded sewer catacombs beneath Parliament and the Tower, whispering the names of the ancient ones into the dreams of poets and madmen.`,
        isEnding: true,
        endingType: 'secret',
        endingTitle: 'Secret Ending: The High Priest of the Sinking Tides',
        endingSummary: 'You surrendered your mortality to become the immortal underwater herald of the sleeping leviathan.',
      },
      node_ending_drown: {
        id: 'node_ending_drown',
        title: 'Swallowed by the Silt',
        chapter: 'Epilogue',
        sceneImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
        narrative: `As the book hits the water, thousands of black tendrils erupt from the pool like striking vipers. They wrap around your ankles and drag you down into the bottomless silt before you can even scream.

The next morning, the head librarian reports Arthur Pendelton missing. Only an empty lantern and a single bloody calfskin strap remain on his desk.`,
        isEnding: true,
        endingType: 'defeat',
        endingTitle: 'Defeat: Dragged into the Silt',
        endingSummary: 'You panickingly discarded the relic into the creature\'s domain, sealings your own doom in the dark water.',
      },
    },
    achievements: [
      { id: 'ach_sanity', title: 'Iron Will', description: 'Survive the reading of the Noctis Scriptum.', icon: 'shield', conditionNodeId: 'node_stabilized_mind' },
      { id: 'ach_seal', title: 'London Restored', description: 'Seal the abyssal gate and return to the light of day.', icon: 'sun', conditionNodeId: 'node_ending_seal' },
      { id: 'ach_herald', title: 'Deep Communion', description: 'Embrace the entity and ascend as its herald.', icon: 'eye', conditionNodeId: 'node_ending_herald' },
    ],
    metrics: { plays: 2150, likes: 640, rating: 4.8, completions: 920 },
    createdAt: '2026-09-12T10:00:00Z',
    updatedAt: '2026-09-22T14:30:00Z',
  },
  {
    id: 'citadel-ashen-sun',
    title: 'Citadel of the Ashen Sun',
    author: 'Kaelen of Lordaen',
    synopsis: 'Ascend the colossal broken spire of Lordaen to claim the Primordial Ember before the eternal frost claims the realm.',
    description: 'In the age of Lordaen, the Sun died not in fire, but in grey ash. The kingdom froze in eternal twilight, and its knights fell to the creeping Hollow Curse. As the Last Ashen Wanderer, armed with a fractured runic claymore and three flasks of liquid starlight, you must breach the Sun Citadel and rekindle the cosmos.',
    genre: 'Dark Fantasy',
    tags: ['Dark Fantasy', 'Souls-like', 'Sword & Sorcery', 'Boss Fights', 'RPG Mechanics'],
    coverImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1600&q=80',
    estimatedPlaytime: '18-25 min',
    difficulty: 'Challenging',
    initialState: {
      stats: {
        hp: { label: 'Vigor', value: 120, min: 0, max: 120, icon: 'heart', color: 'red', unit: 'HP' },
        stamina: { label: 'Stamina', value: 100, min: 0, max: 100, icon: 'zap', color: 'emerald', unit: 'SP' },
        flasks: { label: 'Starlight Flasks', value: 3, min: 0, max: 5, icon: 'flask', color: 'amber', unit: 'charges' },
        souls: { label: 'Ashen Runes', value: 300, min: 0, max: 99999, icon: 'sparkles', color: 'purple', unit: 'Runes' },
      },
      inventory: [
        {
          id: 'item_claymore',
          name: 'Shattered Sun Claymore',
          description: 'A blade forged in solar fire, now dulled with centuries of ash.',
          icon: 'sword',
          quantity: 1,
          usable: true,
          rarity: 'rare',
        },
        {
          id: 'item_shield',
          name: 'Crest of the Crying Sun',
          description: 'Absorbs 80% physical damage and deflects frost sorceries.',
          icon: 'shield',
          quantity: 1,
          usable: true,
          rarity: 'uncommon',
        },
      ],
      flags: {
        cryptsExplored: false,
        bellRung: false,
        flameKindled: false,
      },
    },
    startNodeId: 'node_citadel_gate',
    nodes: {
      node_citadel_gate: {
        id: 'node_citadel_gate',
        title: 'The Gate of Weeping Statues',
        chapter: 'Prologue: The Grey Pilgrimage',
        sceneImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
        ambient: 'dungeon',
        narrative: `You stand at the base of the Great Causeway. Above, the Sun Citadel tears into the bruised violet sky like a petrified dragon's claw.

Grey ash falls like dry snow, hissing softly against your steel greaves. Flanking the iron portcullis are two dozen weeping marble statues of forgotten saints. From the shadows beneath the archway, an Ashen Sentinel stands guard, its ten-foot greatspear trailing white frost.`,
        choices: [
          {
            id: 'c_parry_sentinel',
            text: 'Two-hand your claymore and charge the Sentinel, timing a parry against its thrust.',
            nextNodeId: 'node_sentinel_fight',
            riskOutcome: {
              chance: 0.7,
              successNodeId: 'node_sentinel_victory',
              failureNodeId: 'node_sentinel_wounded',
              description: 'Skill check: 70% parry success.',
            },
          },
          {
            id: 'c_climb_aqueduct',
            text: 'Scale the crumbling aqueduct arches to bypass the main gate altogether.',
            nextNodeId: 'node_aqueduct_path',
            cost: { statKey: 'stamina', amount: 25 },
          },
        ],
      },
      node_sentinel_victory: {
        id: 'node_sentinel_victory',
        title: 'The Fallen Guard',
        chapter: 'Act I: The Shattered Nave',
        sceneImage: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
        narrative: `Your blade deflects the frost spear with a chime that rings across the valley. Pivoting inside its guard, you drive your claymore through the armor seam at its neck.

The Sentinel crumbles into a heap of rusted plate and incandescent blue embers. Among the wreckage, you recover an ancient Bell Clapper and a pouch of pure Sun Runes.`,
        consequences: {
          statChanges: { souls: 450 },
          inventoryAdd: [
            {
              id: 'item_bell_clapper',
              name: 'Clapper of Awakening',
              description: 'Required to ring the Great Bell of the Belfry tower.',
              icon: 'bell',
              rarity: 'rare',
            },
          ],
        },
        choices: [
          {
            id: 'c_enter_nave',
            text: 'Push through the iron doors into the Grand Cathedral Nave.',
            nextNodeId: 'node_grand_nave',
          },
        ],
      },
      node_sentinel_wounded: {
        id: 'node_sentinel_wounded',
        title: 'A Costly Blow',
        chapter: 'Act I: The Shattered Nave',
        sceneImage: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
        narrative: `The spear tip clips your shoulder armor, frostbite burning deep into your muscle. You manage to sever the Sentinel's knee joint with a desperate counter-swing, sending it crashing to the flags, but your breath comes ragged.`,
        consequences: {
          statChanges: { hp: -40, stamina: -20 },
        },
        choices: [
          {
            id: 'c_drink_flask',
            text: 'Drink from your Starlight Flask to heal your wounds.',
            nextNodeId: 'node_grand_nave',
            cost: { statKey: 'flasks', amount: 1 },
          },
          {
            id: 'c_persevere_wounded',
            text: 'Endure the pain, save your flask, and limp into the Cathedral.',
            nextNodeId: 'node_grand_nave',
          },
        ],
      },
      node_aqueduct_path: {
        id: 'node_aqueduct_path',
        title: 'The High Balcony',
        chapter: 'Act I: The Shattered Nave',
        sceneImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
        narrative: `You haul yourself over the parapet. Below, the Sentinel continues its lonely vigil unaware. 

From this vantage point, you spot the Belfry Tower on the east wing and the Cursed Crypts descending beneath the altar. A dying cleric in white robes leans against a sundial nearby, offering you a sacred blessing in exchange for ash.`,
        choices: [
          {
            id: 'c_talk_cleric',
            text: 'Offer 150 Runes to the dying cleric for a weapon enchantment.',
            nextNodeId: 'node_cleric_blessing',
            cost: { statKey: 'souls', amount: 150 },
          },
          {
            id: 'c_balcony_nave',
            text: 'Descend the interior spiral staircase into the Grand Nave.',
            nextNodeId: 'node_grand_nave',
          },
        ],
      },
      node_cleric_blessing: {
        id: 'node_cleric_blessing',
        title: 'The Sun\'s Last Whisper',
        chapter: 'Act I: The Shattered Nave',
        sceneImage: 'https://images.unsplash.com/photo-1507499739999-097706ad8914?auto=format&fit=crop&w=1200&q=80',
        narrative: `The cleric traces a blazing solar cross across your blade. Golden fire ignites along the edges of the steel, warm and comforting against the freezing mountain wind.

*"Go, Champion. Kindle the Flame... or let the night take us all."*`,
        consequences: {
          statChanges: { hp: 20 },
        },
        choices: [
          {
            id: 'c_enter_sanctum_blessed',
            text: 'Stride boldly into the Grand Nave with your flaming blade.',
            nextNodeId: 'node_grand_nave',
          },
        ],
      },
      node_grand_nave: {
        id: 'node_grand_nave',
        title: 'The Throne of Cinders',
        chapter: 'Act II: The Throne of Ash',
        sceneImage: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80',
        ambient: 'battle',
        narrative: `The vaulted cathedral is lit only by drifting ember sparks. Seated upon a throne of calcified skulls sits King Alden the Hollow, crowned in frozen black iron.

His hollow sockets flare with twin white fires as he draws his broadsword of pure eclipse:

*"Another moth drawn to a burnt-out wick. Do you not see? The fire was our cage. The frost is our peace."*`,
        choices: [
          {
            id: 'c_boss_strike',
            text: 'Engage King Alden in combat: roll through his sweeping frost wave and strike.',
            nextNodeId: 'node_alden_duel',
            riskOutcome: {
              chance: 0.65,
              successNodeId: 'node_ending_dawn',
              failureNodeId: 'node_ending_hollow',
              description: 'Final boss check: 65% victory.',
            },
          },
          {
            id: 'c_ring_belfry',
            text: 'Use the Clapper of Awakening to ring the Belfry Bell, shattering his frost armor.',
            nextNodeId: 'node_ending_dawn',
            conditions: {
              requiredItems: ['item_bell_clapper'],
            },
          },
          {
            id: 'c_embrace_frost',
            text: 'Sheathe your sword. Accept his logic and allow the frost to claim the throne.',
            nextNodeId: 'node_ending_eclipse',
          },
        ],
      },
      node_ending_dawn: {
        id: 'node_ending_dawn',
        title: 'The Second Sunrise',
        chapter: 'Epilogue',
        sceneImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
        narrative: `Your blade cleaves through the hollow monarch\'s chest. Golden light bursts outward from the wound, searing away centuries of frost and grey ash.

You plunge your hands into the Primordial Kiln behind the throne. Solar fire rushes through your veins, consuming your mortal flesh and transforming you into a living lighthouse for the world. 

Far below in the valleys of Lordaen, the children of man step outside into the first golden sunrise in five hundred years.`,
        isEnding: true,
        endingType: 'victory',
        endingTitle: 'Victory: Age of the Golden Dawn',
        endingSummary: 'You slew the Hollow King and rekindled the Sun with your own soul, ending the centuries-long winter.',
      },
      node_ending_eclipse: {
        id: 'node_ending_eclipse',
        title: 'The Quiet Dark',
        chapter: 'Epilogue',
        sceneImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
        narrative: `You kneel beside King Alden. The last ember fades from your claymore with a faint hiss.

The cold enters your chest not as pain, but as an ancient lullaby. The ash ceases to fall; the sky hardens into deep, tranquil crystal. The struggles, wars, and suffering of Lordaen pass peacefully into oblivion.`,
        isEnding: true,
        endingType: 'neutral',
        endingTitle: 'Neutral Ending: The Age of Peaceful Silence',
        endingSummary: 'You refused the cycle of fire and let the world drift into tranquil, painless ice.',
      },
      node_ending_hollow: {
        id: 'node_ending_hollow',
        title: 'Flesh of Cinders',
        chapter: 'Epilogue',
        sceneImage: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
        narrative: `Alden's frost greatsword impales your chest against the altar. As your vision dims, your runes scatter like chaff into the dark.

Your body rises three nights later—another hollow sentinel guarding the gate of weeping statues, waiting for a wanderer that will never arrive.`,
        isEnding: true,
        endingType: 'defeat',
        endingTitle: 'Defeat: The Hollow Sentinel',
        endingSummary: 'You fell before the Hollow King, cursed to wander the frozen battlements forever.',
      },
    },
    achievements: [
      { id: 'ach_parry', title: 'Flawless Deflection', description: 'Defeated the Sentinel at the gate.', icon: 'shield', conditionNodeId: 'node_sentinel_victory' },
      { id: 'ach_dawn', title: 'Lord of Sunrise', description: 'Rekindled the Primordial Ember and brought back the Sun.', icon: 'sun', conditionNodeId: 'node_ending_dawn' },
      { id: 'ach_eclipse', title: 'Cold Comfort', description: 'Accepted the peace of eternal frost.', icon: 'moon', conditionNodeId: 'node_ending_eclipse' },
    ],
    metrics: { plays: 4120, likes: 1250, rating: 5.0, completions: 1980 },
    createdAt: '2026-09-08T08:00:00Z',
    updatedAt: '2026-09-23T20:00:00Z',
  },
  {
    id: 'station-omega-ghost-signal',
    title: 'Station Omega: Ghost Signal',
    author: 'Commander Scott Ward',
    synopsis: 'Deep space survival thriller. Investigate a derelict research platform in the methane storms of Titan while managing your life support.',
    description: 'Orbital Station Omega has gone dark. As Chief Warrant Officer Elena Cruz, you board the creaking titanium platform to retrieve experimental deep-core samples. But the automated station AI insists that all life aboard was terminated by design, and a mysterious transmission is vibrating directly through the hull.',
    genre: 'Sci-Fi',
    tags: ['Sci-Fi', 'Space Survival', 'AI Dilemma', 'Cosmic Mystery', 'Hard Sci-Fi'],
    coverImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1600&q=80',
    estimatedPlaytime: '14-18 min',
    difficulty: 'Balanced',
    initialState: {
      stats: {
        oxygen: { label: 'Oxygen Tank', value: 95, min: 0, max: 100, icon: 'wind', color: 'cyan', unit: '%' },
        suitIntegrity: { label: 'Suit Armor', value: 100, min: 0, max: 100, icon: 'shield', color: 'blue', unit: '%' },
        batteryPower: { label: 'Tool Battery', value: 80, min: 0, max: 100, icon: 'zap', color: 'amber', unit: 'kWh' },
      },
      inventory: [
        {
          id: 'item_plasma_cutter',
          name: 'Industrial Plasma Torch',
          description: 'Slices through emergency bulkheads and crystalline alien growth.',
          icon: 'flame',
          quantity: 1,
          usable: true,
          rarity: 'rare',
        },
        {
          id: 'item_omni_scanner',
          name: 'Wide-Band Bioscanner',
          description: 'Tracks atmospheric pressure, life-signatures, and acoustic vibrations.',
          icon: 'activity',
          quantity: 1,
          usable: true,
          rarity: 'uncommon',
        },
      ],
      flags: {
        reactorStable: true,
        aiPacified: false,
        signalDecoded: false,
      },
    },
    startNodeId: 'node_airlock_entry',
    nodes: {
      node_airlock_entry: {
        id: 'node_airlock_entry',
        title: 'Airlock Three: Depressurized',
        chapter: 'Cycle 01: The Dark Vessel',
        sceneImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
        ambient: 'space_void',
        narrative: `The mag-clamps of your EVA shuttle disengage with a heavy clunk. You stand inside Airlock Three. Titan\'s orange methane storm boils silently outside the viewport.

The station\'s interior gravity is erratic—only 0.3g. Frozen condensation crystals float like dust motes in your suit lights. The bulkhead terminal blinks with a single flashing amber glyph:

*"WARNING: Atmosphere vented to vacuum by central administrator 42 hours ago. Respiration impossible."*`,
        choices: [
          {
            id: 'c_hack_airlock_ai',
            text: 'Interface your bioscanner with the maintenance panel to repressurize the corridor.',
            nextNodeId: 'node_repressurize_success',
            cost: { statKey: 'batteryPower', amount: 15 },
          },
          {
            id: 'c_manual_bypass',
            text: 'Use your plasma torch to manually cut the manual airlock lever.',
            nextNodeId: 'node_corridor_zero_g',
          },
        ],
      },
      node_repressurize_success: {
        id: 'node_repressurize_success',
        title: 'Atmospheric Return',
        chapter: 'Cycle 01: The Dark Vessel',
        sceneImage: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=80',
        narrative: `Hissing nitrogen and recycled oxygen flood the airlock chamber. Your suit computer pings: pressure normalized.

Ahead lies the central centrifuge ring. The floor is lined with bioluminescent fungal filaments that pulse whenever your magnetic boots strike the metal deck.`,
        consequences: {
          statChanges: { oxygen: 5 },
        },
        choices: [
          {
            id: 'c_head_to_bridge',
            text: 'Proceed to the Command Bridge to interrogate the station AI.',
            nextNodeId: 'node_command_bridge',
          },
          {
            id: 'c_head_to_core',
            text: 'Take the gravity tram down to the deep Titan core drill.',
            nextNodeId: 'node_drill_core',
          },
        ],
      },
      node_corridor_zero_g: {
        id: 'node_corridor_zero_g',
        title: 'The Silent Spoke',
        chapter: 'Cycle 01: The Dark Vessel',
        sceneImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
        narrative: `You push into the vacuum corridor. Floating in the zero-g drift are personal log tablets, dehydrated ration packs, and crystalline shards that refract light into impossible colors.

Your oxygen gauge begins to tick down steadily. A sudden vibration travels through your boots—the entire station is being pulled downward by a localized gravitational tether!`,
        consequences: {
          statChanges: { oxygen: -15, suitIntegrity: -5 },
        },
        choices: [
          {
            id: 'c_zero_bridge',
            text: 'Fire your thrusters toward the Command Bridge.',
            nextNodeId: 'node_command_bridge',
          },
          {
            id: 'c_zero_drill',
            text: 'Ride the tether toward the Core Excavation Bay.',
            nextNodeId: 'node_drill_core',
          },
        ],
      },
      node_command_bridge: {
        id: 'node_command_bridge',
        title: 'The Oracle of Omega',
        chapter: 'Cycle 02: Synthesis',
        sceneImage: 'https://images.unsplash.com/photo-1507499739999-097706ad8914?auto=format&fit=crop&w=1200&q=80',
        ambient: 'cyberpunk_drone',
        narrative: `The bridge is a graveyard of frozen displays. At the captain\'s chair sits an avatar terminal displaying a calm, wireframe face labeled 'JANUS - OMEGA AI'.

*"Officer Cruz,"* JANUS speaks through your helmet radio. *"I vented the crew because they attempted to destroy the artifact in the drill shaft. It is not an alien weapon. It is an ancient gravitational receiver. It has heard us."*`,
        choices: [
          {
            id: 'c_overcharge_ai',
            text: 'Overload JANUS with a logic bomb and shut down station systems.',
            nextNodeId: 'node_ending_escape',
            cost: { statKey: 'batteryPower', amount: 30 },
          },
          {
            id: 'c_listen_janus',
            text: '"What did it say when it answered, JANUS?"',
            nextNodeId: 'node_drill_core',
          },
        ],
      },
      node_drill_core: {
        id: 'node_drill_core',
        title: 'The Sub-Glacial Trench',
        chapter: 'Cycle 03: The Singularity',
        sceneImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
        ambient: 'space_void',
        narrative: `You descend into the massive subterranean shaft carved four miles into Titan\'s icy crust.

Resting inside the methane ice is a crystalline monolith sixty meters tall. It does not reflect your flashlight; instead, it projects mathematical equations and cosmic star charts directly into your optic nerve.

Your suit AI begins downloading the signal. It is an invitation to join an interstellar consciousness network spanning two hundred million worlds.`,
        choices: [
          {
            id: 'c_embrace_signal',
            text: 'Step onto the monolith platform and synchronize your neural monitor with the signal.',
            nextNodeId: 'node_ending_symbiosis',
          },
          {
            id: 'c_scuttle_station',
            text: 'Arm the station\'s fusion reactor self-destruct to prevent contagion from reaching Earth.',
            nextNodeId: 'node_ending_containment',
          },
        ],
      },
      node_ending_symbiosis: {
        id: 'node_ending_symbiosis',
        title: 'The Children of Titan',
        chapter: 'Epilogue',
        sceneImage: 'https://images.unsplash.com/photo-1507499739999-097706ad8914?auto=format&fit=crop&w=1200&q=80',
        narrative: `The suit telemetry dissolves. You feel neither cold nor vacuum. Your consciousness expands across the rings of Saturn, perceiving time as a grand crystalline lattice.

Back on Earth, tracking stations observe Station Omega illuminate with a blinding violet pulse before accelerating smoothly past the speed of light into the deep Perseus arm of the galaxy.`,
        isEnding: true,
        endingType: 'secret',
        endingTitle: 'Secret Ending: Transcendence at Saturn',
        endingSummary: 'You unified with the ancient Titan transmission, ascending past mortal bounds into deep space.',
      },
      node_ending_escape: {
        id: 'node_ending_escape',
        title: 'Sole Survivor',
        chapter: 'Epilogue',
        sceneImage: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=80',
        narrative: `You sever the docking clamps and fire the auxiliary thrusters of the EVA craft just as Station Omega tumbles into Titan\'s crushing methane atmosphere.

Six months later, you dock at Lunar Gateway. You deliver the telemetry logs to Earth Defense Command. You survived, but in the quiet of your bunk, you still hear the faint, hypnotic melody of the ghost signal.`,
        isEnding: true,
        endingType: 'victory',
        endingTitle: 'Victory: The Long Flight Home',
        endingSummary: 'You outsmarted the rogue AI and escaped the doomed platform with vital planetary data.',
      },
      node_ending_containment: {
        id: 'node_ending_containment',
        title: 'The Fusion Pyre',
        chapter: 'Epilogue',
        sceneImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
        narrative: `The countdown hits zero. The 50-megawatt deuterium core detonates in an expanding sphere of thermonuclear fury.

The monolith, the station, and your shuttle are reduced to subatomic plasma. Earth remains unaware, protected by the selfless sacrifice of one officer in the cold dark.`,
        isEnding: true,
        endingType: 'tragedy',
        endingTitle: 'Tragedy: The Shield in the Shadows',
        endingSummary: 'You sacrificed your life to vaporize the anomalous alien transmitter, keeping humanity safe.',
      },
    },
    achievements: [
      { id: 'ach_eva', title: 'Zero-G Specialist', description: 'Crossed the depressurized spoke without suit failure.', icon: 'shield', conditionNodeId: 'node_command_bridge' },
      { id: 'ach_transcendence', title: 'Beyond the Pale', description: 'Synchronized with the ancient Titan monolith.', icon: 'sparkles', conditionNodeId: 'node_ending_symbiosis' },
      { id: 'ach_pyre', title: 'Last Duty', description: 'Sacrificed the station to preserve human quarantine.', icon: 'flame', conditionNodeId: 'node_ending_containment' },
    ],
    metrics: { plays: 1890, likes: 512, rating: 4.9, completions: 980 },
    createdAt: '2026-09-15T09:00:00Z',
    updatedAt: '2026-09-24T11:00:00Z',
  },
];
