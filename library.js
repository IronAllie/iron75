/* Equipment, exercise library and the program generator. */

export const EQUIPMENT_GROUPS = [
  ["Free weights", [
    ["barbell", "Barbell + plates"], ["rack", "Squat rack or power rack (with safeties)"], ["bench", "Flat bench"], ["incline_bench", "Adjustable / incline bench"],
    ["dumbbells", "Dumbbells"], ["kettlebell", "Kettlebell(s)"], ["ez_bar", "EZ curl bar"], ["trap_bar", "Trap / hex bar"], ["landmine", "Landmine"]]],
  ["Cables & machines", [
    ["cable", "Cable / pulley station (high and low)"], ["lat_pulldown", "Lat pulldown machine"], ["row_machine", "Seated row machine"], ["leg_press", "Leg press"],
    ["hack_squat", "Hack squat machine"], ["smith", "Smith machine"], ["leg_ext", "Leg extension"], ["leg_curl", "Leg curl"], ["chest_press", "Chest press machine"],
    ["shoulder_press", "Shoulder press machine"], ["pec_deck", "Pec deck / rear delt fly"], ["calf_machine", "Calf raise machine"], ["back_ext", "Back extension / GHD"]]],
  ["Bodyweight", [
    ["pullup_bar", "Pull-up bar"], ["dip_station", "Dip station / parallel bars"], ["rings", "Gymnastic rings or TRX"], ["bands", "Resistance bands"], ["box", "Plyo box or sturdy step"],
    ["ab_wheel", "Ab wheel"], ["stability_ball", "Stability ball"]]],
  ["Cardio & conditioning", [
    ["battle_rope", "Battle rope"], ["rower", "Rowing machine"], ["bike", "Bike / air bike"], ["treadmill", "Treadmill"], ["jump_rope", "Jump rope"], ["sled", "Sled"], ["med_ball", "Medicine / slam ball"]]],
  ["Recovery", [["mat", "Yoga mat"], ["blocks", "Yoga blocks"], ["foam_roller", "Foam roller"]]]
];
export const EQUIPMENT_LABEL = Object.fromEntries(EQUIPMENT_GROUPS.flatMap(g => g[1]));

export const PRESETS = [
  { id: "prx", name: "Garage: PRX rack + Titan cable tower", eq: ["barbell","rack","bench","incline_bench","dumbbells","landmine","cable","pullup_bar","dip_station","battle_rope","mat","blocks"], dbMax: 52.5, dbKind: "selecttech552" },
  { id: "commercial", name: "Full commercial gym", eq: EQUIPMENT_GROUPS.flatMap(g => g[1].map(x => x[0])), dbMax: 120, dbKind: "fixed5" },
  { id: "garage", name: "Garage barbell gym", eq: ["barbell","rack","bench","incline_bench","dumbbells","pullup_bar","bands","mat"], dbMax: 50, dbKind: "fixed5" },
  { id: "dumbbell", name: "Dumbbells + bench only", eq: ["dumbbells","bench","incline_bench","mat"], dbMax: 50, dbKind: "fixed5" },
  { id: "minimal", name: "Bodyweight + bands (home or travel)", eq: ["bands","pullup_bar","mat","jump_rope"], dbMax: 0, dbKind: "none" }
];
export const DB_KINDS = {
  selecttech552: { label: "Bowflex SelectTech 552 (5–52.5 lb)", steps: [5,7.5,10,12.5,15,17.5,20,22.5,25,30,35,40,45,50,52.5] },
  selecttech1090: { label: "Bowflex SelectTech 1090 (10–90 lb)", steps: [10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90] },
  powerblock: { label: "PowerBlock-style (2.5 lb steps)", steps: null, step: 2.5 },
  fixed5: { label: "Fixed dumbbells in 5 lb steps", steps: null, step: 5 },
  none: { label: "No dumbbells", steps: [] }
};

/* Exercise library.
   pattern: movement slot used by the generator. tier: 1 main lift, 2 secondary compound, 3 accessory.
   load: bb barbell, db dumbbell, kb kettlebell, cable, machine, lm landmine, bw bodyweight, band.
   req: every entry must be owned; an entry like "bench|incline_bench" means either one. */
const X = [];
function E(id, name, pattern, tier, load, req, muscles, cue, extra) { X.push({ id, name, pattern, tier, load, req, muscles, cue, ...(extra || {}) }); }
// Squat
E("back_squat","Barbell Back Squat","squat",1,"bb",["barbell","rack"],"quads, glutes","Safeties just below your bottom position. Brace hard, sit between your heels, drive straight up.");
E("front_squat","Barbell Front Squat","squat",1,"bb",["barbell","rack"],"quads, upper back","Elbows high, bar on your shoulders, sit straight down.");
E("hack_squat","Hack Squat","squat",2,"machine",["hack_squat"],"quads","Feet low on the platform for quads. Control the bottom.");
E("leg_press","Leg Press","squat",2,"machine",["leg_press"],"quads, glutes","Lower until your hips start to roll, then press. Don't lock out hard.");
E("smith_squat","Smith Machine Squat","squat",2,"machine",["smith"],"quads","Feet slightly forward of the bar.");
E("landmine_squat","Landmine Squat","squat",2,"lm",["landmine","barbell"],"quads, glutes","Hold the sleeve at your chest. Sit between your heels.");
E("goblet_squat","Goblet Squat","squat",2,"db",["dumbbells|kettlebell"],"quads, glutes","Weight at your chest, elbows inside knees at the bottom.");
E("db_front_squat","Dumbbell Front Squat","squat",2,"db",["dumbbells"],"quads","Dumbbells on your shoulders, torso tall.");
E("bw_squat","Tempo Bodyweight Squat","squat",3,"bw",[],"quads","3 seconds down, pause, stand.",{reps:[15,25]});
E("band_squat","Banded Squat","squat",3,"band",["bands"],"quads, glutes","Stand on the band, loop it over your shoulders.",{reps:[12,20]});
// Hinge
E("deadlift","Conventional Deadlift","hinge",1,"bb",["barbell"],"hamstrings, glutes, back","Bar over mid-foot. Pull the slack out, then push the floor away.");
E("trap_deadlift","Trap Bar Deadlift","hinge",1,"bb",["trap_bar"],"glutes, quads, back","Stand in the center, chest up, push the floor away.");
E("rdl","Barbell Romanian Deadlift","hinge",2,"bb",["barbell"],"hamstrings, glutes","Soft knees, push hips back, bar slides to mid-shin, flat back.");
E("hip_thrust","Barbell Hip Thrust","hinge",2,"bb",["barbell","bench"],"glutes","Upper back on the bench, chin tucked, pause at the top.");
E("good_morning","Good Morning","hinge",2,"bb",["barbell","rack"],"hamstrings, low back","Bar on your back, soft knees, hinge until your back is near parallel.");
E("landmine_rdl","Landmine Romanian Deadlift","hinge",2,"lm",["landmine","barbell"],"hamstrings, glutes","Hold the sleeve with both hands, hinge back.");
E("db_rdl","Dumbbell Romanian Deadlift","hinge",2,"db",["dumbbells"],"hamstrings, glutes","Dumbbells slide down your thighs, hips back.");
E("kb_swing","Kettlebell Swing","hinge",3,"kb",["kettlebell|dumbbells"],"glutes, hamstrings","Hike it back, snap your hips. Arms are ropes.",{reps:[15,25]});
E("pull_through","Cable Pull-Through","hinge",3,"cable",["cable"],"glutes, hamstrings","Face away from the stack, rope between your legs, hinge and snap through.");
E("back_ext","45° Back Extension","hinge",3,"bw",["back_ext"],"glutes, hamstrings, low back","Round slightly at the bottom, squeeze glutes to rise.",{reps:[12,20]});
E("sl_rdl","Single-Leg Dumbbell RDL","hinge",3,"db",["dumbbells"],"hamstrings, glutes","Touch something for balance. Square hips.");
E("db_hip_thrust","Dumbbell Hip Thrust","hinge",3,"db",["dumbbells","bench|incline_bench"],"glutes","Dumbbell on your hips, pause at the top.");
E("glute_bridge","Glute Bridge","hinge",3,"bw",[],"glutes","Drive through heels, pause 2 s at the top.",{reps:[15,25]});
E("band_pull_through","Band Pull-Through","hinge",3,"band",["bands"],"glutes","Anchor the band low behind you.",{reps:[15,25]});
// Lunge / single leg
E("bss","Dumbbell Bulgarian Split Squat","lunge",2,"db",["dumbbells","bench|incline_bench|box"],"quads, glutes","Rear foot on the bench, front knee travels forward.",{per:"leg"});
E("bb_lunge","Barbell Reverse Lunge","lunge",2,"bb",["barbell","rack"],"quads, glutes","Step back softly, front shin near vertical.",{per:"leg"});
E("db_rev_lunge","Dumbbell Reverse Lunge","lunge",2,"db",["dumbbells"],"quads, glutes","Step back softly, torso tall.",{per:"leg"});
E("walking_lunge","Dumbbell Walking Lunge","lunge",2,"db",["dumbbells"],"quads, glutes","Long steps, knee kisses the floor.",{per:"leg"});
E("step_up","Dumbbell Step-Up","lunge",2,"db",["dumbbells","box|bench"],"quads, glutes","Drive through the top foot only.",{per:"leg"});
E("lm_lunge","Landmine Reverse Lunge","lunge",2,"lm",["landmine","barbell"],"quads, glutes","Hold the sleeve at your chest, step back.",{per:"leg"});
E("bw_bss","Bodyweight Bulgarian Split Squat","lunge",3,"bw",["bench|box|incline_bench"],"quads, glutes","Slow down, pause at the bottom.",{per:"leg",reps:[10,20]});
E("split_squat","Split Squat","lunge",3,"bw",[],"quads, glutes","Stay tall, back knee to the floor.",{per:"leg",reps:[12,20]});
// Horizontal push
E("bench_press","Barbell Bench Press","h_push",1,"bb",["barbell","rack","bench|incline_bench"],"chest, triceps, shoulders","Safeties set just below chest height. Shoulder blades pinned, touch low chest.");
E("incline_bench","Incline Barbell Bench Press","h_push",1,"bb",["barbell","rack","incline_bench"],"upper chest, shoulders","Bench at 30°. Touch the upper chest.");
E("incline_db","Incline Dumbbell Press","h_push",2,"db",["dumbbells","incline_bench"],"upper chest, shoulders","Bench at about 30°. Lower to the upper chest.");
E("db_bench","Dumbbell Bench Press","h_push",2,"db",["dumbbells","bench|incline_bench"],"chest, triceps","Lower to chest level, elbows about 45°.");
E("close_grip_bench","Close-Grip Bench Press","h_push",2,"bb",["barbell","rack","bench|incline_bench"],"triceps, chest","Hands shoulder-width, elbows tucked.");
E("db_floor_press","Dumbbell Floor Press","h_push",2,"db",["dumbbells"],"chest, triceps","Lie on the floor, pause elbows on the ground.");
E("chest_press","Machine Chest Press","h_push",2,"machine",["chest_press"],"chest","Handles at mid-chest. Control the stretch.");
E("smith_bench","Smith Machine Bench Press","h_push",2,"machine",["smith","bench|incline_bench"],"chest","Bar to lower chest.");
E("dips","Dips","h_push",2,"bw",["dip_station"],"chest, triceps","Slight forward lean, go until shoulders are just below elbows.",{reps:[6,12]});
E("ring_pushup","Ring or TRX Push-Up","h_push",2,"bw",["rings"],"chest, core","Turn the rings out at the top.",{reps:[8,15]});
E("pushup","Push-Up","h_push",3,"bw",[],"chest, triceps","Body in one line, chest to the floor.",{reps:[10,25]});
E("band_press","Banded Push-Up","h_push",3,"band",["bands"],"chest, triceps","Band across your upper back, hands pin the ends.",{reps:[8,15]});
// Vertical push
E("ohp","Barbell Overhead Press","v_push",1,"bb",["barbell","rack"],"shoulders, triceps","Squeeze glutes, press up and slightly back over your head.");
E("seated_db_press","Seated Dumbbell Shoulder Press","v_push",2,"db",["dumbbells","incline_bench"],"shoulders, triceps","Bench upright, press without arching.");
E("standing_db_press","Standing Dumbbell Press","v_push",2,"db",["dumbbells"],"shoulders, triceps, core","Ribs down, press overhead.");
E("lm_press","Half-Kneeling Landmine Press","v_push",2,"lm",["landmine","barbell"],"shoulders, upper chest","Squeeze the glute of the down knee, press up and forward.",{per:"side"});
E("machine_press","Machine Shoulder Press","v_push",2,"machine",["shoulder_press"],"shoulders","Handles start at chin height.");
E("kb_press","Kettlebell Overhead Press","v_push",2,"kb",["kettlebell"],"shoulders","Bell rests on your forearm, press straight up.",{per:"side"});
E("arnold","Arnold Press","v_push",3,"db",["dumbbells"],"shoulders","Rotate palms out as you press.");
E("pike_pushup","Pike Push-Up","v_push",3,"bw",[],"shoulders, triceps","Hips high, head goes between your hands.",{reps:[6,15]});
E("band_ohp","Band Overhead Press","v_push",3,"band",["bands"],"shoulders","Stand on the band, press overhead.",{reps:[10,20]});
// Horizontal pull
E("bb_row","Barbell Bent-Over Row","h_pull",2,"bb",["barbell"],"lats, upper back","Hinge to 45°, pull to your stomach.");
E("tbar_row","Landmine T-Bar Row","h_pull",2,"lm",["landmine","barbell"],"upper back, lats","Straddle the bar, V-handle or hands under the sleeve, row to the stomach.");
E("cs_row","Chest-Supported Dumbbell Row","h_pull",2,"db",["dumbbells","incline_bench"],"upper back, lats","Chest on the incline bench, pull elbows back.");
E("db_row","One-Arm Dumbbell Row","h_pull",2,"db",["dumbbells","bench|incline_bench"],"lats, upper back","Knee and hand on the bench, pull to your hip.",{per:"side"});
E("cable_row","Seated Cable Row","h_pull",2,"cable",["cable|row_machine"],"upper back, lats","Pull to your belly button and pause.");
E("inverted_row","Inverted Row","h_pull",2,"bw",["rings|rack|smith"],"upper back","Body straight, chest to the bar or rings.",{reps:[8,15]});
E("meadows_row","Meadows Row","h_pull",3,"lm",["landmine","barbell"],"lats, upper back","Stand side-on to the bar end, row with one hand.",{per:"side"});
E("kb_row","Kettlebell Row","h_pull",3,"kb",["kettlebell"],"upper back","Hinge, pull the bell to your hip.",{per:"side"});
E("band_row","Band Row","h_pull",3,"band",["bands"],"upper back","Anchor the band at chest height.",{reps:[12,20]});
// Vertical pull
E("pullup","Pull-Up","v_pull",1,"bw",["pullup_bar"],"lats, biceps","Full hang to chin over bar. Add weight once you can do 3×10.",{reps:[5,10]});
E("chinup","Chin-Up","v_pull",2,"bw",["pullup_bar"],"lats, biceps","Palms facing you, full range.",{reps:[5,12]});
E("lat_pulldown","Lat Pulldown","v_pull",2,"cable",["lat_pulldown|cable"],"lats","Kneel or sit, pull elbows to your back pockets.");
E("band_pullup","Band-Assisted Pull-Up","v_pull",2,"band",["pullup_bar","bands"],"lats, biceps","Loop the band on the bar, knee or foot in it.",{reps:[6,12]});
E("sa_pulldown","Single-Arm Cable Pulldown","v_pull",3,"cable",["cable"],"lats","Kneel side-on, pull the handle to your hip.",{per:"side"});
E("straight_arm","Straight-Arm Pulldown","v_pull",3,"cable",["cable|bands"],"lats","Arms long, sweep the bar to your thighs.");
E("db_pullover","Dumbbell Pullover","v_pull",3,"db",["dumbbells","bench|incline_bench"],"lats, chest","Long arms, stretch behind your head.");
// Isolation
E("leg_ext","Leg Extension","quad_iso",3,"machine",["leg_ext"],"quads","Pause at the top for 1 s.");
E("sissy_squat","Sissy Squat (assisted)","quad_iso",3,"bw",[],"quads","Hold a post, knees travel forward, heels up.",{reps:[10,20]});
E("reverse_nordic","Reverse Nordic","quad_iso",3,"bw",["mat"],"quads","Kneel tall, lean back with a straight line from knees to head.",{reps:[6,12]});
E("leg_curl","Leg Curl","ham_iso",3,"machine",["leg_curl"],"hamstrings","Control the way down, 3 s.");
E("ball_curl","Stability Ball Leg Curl","ham_iso",3,"bw",["stability_ball"],"hamstrings","Hips up the whole time.",{reps:[10,15]});
E("db_leg_curl","Prone Dumbbell Leg Curl","ham_iso",3,"db",["dumbbells","bench|incline_bench"],"hamstrings","Dumbbell between your feet, lying face-down.");
E("nordic","Nordic Hamstring Curl","ham_iso",3,"bw",["mat"],"hamstrings","Anchor your heels under the rack or a couch, lower as slowly as you can.",{reps:[3,8]});
E("cable_kickback","Cable Glute Kickback","glute",3,"cable",["cable"],"glutes","Kick back and slightly out, squeeze.",{per:"leg"});
E("cable_abduction","Cable Hip Abduction","glute",3,"cable",["cable"],"glute medius","Stand side-on, sweep your leg out.",{per:"leg"});
E("band_abduction","Banded Hip Abduction","glute",3,"band",["bands"],"glute medius","Band above knees, push knees out.",{reps:[15,30]});
E("sl_hip_thrust","Single-Leg Hip Thrust","glute",3,"bw",["bench|incline_bench|box"],"glutes","Upper back on the bench, drive through one heel.",{per:"leg",reps:[10,15]});
E("calf_machine","Standing Calf Raise","calf",3,"machine",["calf_machine|smith"],"calves","Full stretch, 1 s squeeze at the top.");
E("db_calf","Single-Leg Dumbbell Calf Raise","calf",3,"db",["dumbbells"],"calves","Stand on a step or plate, full stretch.",{per:"leg"});
E("bb_calf","Barbell Calf Raise","calf",3,"bb",["barbell","rack"],"calves","Balls of feet on a plate.");
E("bw_calf","Single-Leg Calf Raise","calf",3,"bw",[],"calves","Slow and full range.",{per:"leg",reps:[12,25]});
E("cable_fly","Cable Fly","chest_iso",3,"cable",["cable|pec_deck"],"chest","Soft elbows, hug a tree.");
E("db_fly","Dumbbell Fly","chest_iso",3,"db",["dumbbells","bench|incline_bench"],"chest","Deep stretch, slight elbow bend.");
E("pec_deck","Pec Deck","chest_iso",3,"machine",["pec_deck"],"chest","Pause when the handles meet.");
E("band_fly","Band Fly","chest_iso",3,"band",["bands"],"chest","Anchor behind you at chest height.",{reps:[15,25]});
E("lat_raise","Dumbbell Lateral Raise","lat_delt",3,"db",["dumbbells"],"side delts","Lead with your elbows, stop at shoulder height.",{reps:[12,20]});
E("cable_lat_raise","Cable Lateral Raise","lat_delt",3,"cable",["cable"],"side delts","Handle crosses in front of you, raise out to the side.",{per:"side",reps:[12,20]});
E("band_lat_raise","Band Lateral Raise","lat_delt",3,"band",["bands"],"side delts","Stand on the band.",{reps:[15,25]});
E("face_pull","Face Pull","rear_delt",3,"cable",["cable|bands"],"rear delts, rotator cuff","Pull toward your forehead, split the rope, thumbs back.",{reps:[15,20]});
E("reverse_fly","Dumbbell Reverse Fly","rear_delt",3,"db",["dumbbells"],"rear delts","Chest on an incline bench or hinge over.",{reps:[12,20]});
E("reverse_pec","Reverse Pec Deck","rear_delt",3,"machine",["pec_deck"],"rear delts","Arms long, sweep back.",{reps:[12,20]});
E("band_pull_apart","Band Pull-Apart","rear_delt",3,"band",["bands"],"rear delts","Arms straight, pull the band to your chest.",{reps:[15,30]});
E("bb_curl","Barbell Curl","biceps",3,"bb",["barbell|ez_bar"],"biceps","Elbows pinned, no swing.");
E("db_curl","Dumbbell Curl","biceps",3,"db",["dumbbells"],"biceps","Turn the pinky up at the top.");
E("hammer_curl","Hammer Curl","biceps",3,"db",["dumbbells"],"biceps, forearms","Thumbs up, no swing.");
E("incline_curl","Incline Dumbbell Curl","biceps",3,"db",["dumbbells","incline_bench"],"biceps","Arms hang behind you for a big stretch.");
E("cable_curl","Cable Curl","biceps",3,"cable",["cable"],"biceps","Straight bar or rope, elbows still.");
E("band_curl","Band Curl","biceps",3,"band",["bands"],"biceps","Stand on the band.",{reps:[15,25]});
E("pushdown","Rope Triceps Pushdown","triceps",3,"cable",["cable"],"triceps","Elbows pinned, spread the rope at the bottom.");
E("oh_cable_ext","Overhead Cable Triceps Extension","triceps",3,"cable",["cable"],"triceps (long head)","Face away from the stack, elbows forward, full stretch.");
E("db_skull","Dumbbell Skull Crusher","triceps",3,"db",["dumbbells","bench|incline_bench"],"triceps","Lower toward your temples, elbows still.");
E("ez_skull","EZ-Bar Skull Crusher","triceps",3,"bb",["ez_bar","bench|incline_bench"],"triceps","Bar to just behind your head.");
E("db_oh_ext","Dumbbell Overhead Triceps Extension","triceps",3,"db",["dumbbells"],"triceps (long head)","Both hands on one dumbbell, deep stretch.");
E("bench_dip","Bench Dip","triceps",3,"bw",["bench|incline_bench|box"],"triceps","Hands on the bench, elbows back.",{reps:[10,20]});
E("diamond_pushup","Diamond Push-Up","triceps",3,"bw",[],"triceps","Hands together under your chest.",{reps:[8,20]});
E("band_pushdown","Band Pushdown","triceps",3,"band",["bands"],"triceps","Anchor the band high.",{reps:[15,25]});
// Core
E("cable_crunch","Kneeling Cable Crunch","core_flex",3,"cable",["cable"],"abs","Hips still, curl ribs to pelvis.");
E("hanging_raise","Hanging Knee or Leg Raise","core_flex",3,"bw",["pullup_bar|dip_station"],"abs, hip flexors","No swinging. Curl your pelvis up.",{reps:[8,15]});
E("ab_wheel","Ab Wheel Rollout","core_flex",3,"bw",["ab_wheel"],"abs","Ribs down, roll only as far as you can keep a flat back.",{reps:[6,12]});
E("dead_bug","Dead Bug","core_flex",3,"bw",[],"abs","Low back pressed to the floor.",{reps:[8,12],per:"side"});
E("plank","Plank","core_anti",3,"bw",[],"abs, core","Squeeze glutes and quads, push the floor away.",{unit:"sec",reps:[30,60]});
E("side_plank","Side Plank","core_anti",3,"bw",[],"obliques","Hips high, straight line.",{unit:"sec",reps:[20,45],per:"side"});
E("pallof","Pallof Press","core_anti",3,"cable",["cable|bands"],"obliques, core","Stand side-on, press out and resist the twist.",{per:"side",reps:[10,15]});
E("lm_rotation","Landmine Rotation","core_anti",3,"lm",["landmine","barbell"],"obliques","Arms long, pivot your back foot.",{per:"side",reps:[8,12]});
E("farmer_carry","Farmer Carry","core_anti",3,"db",["dumbbells|kettlebell|trap_bar"],"grip, core, traps","Heavy, tall, short steps.",{unit:"sec",reps:[30,60]});
E("suitcase_carry","Suitcase Carry","core_anti",3,"db",["dumbbells|kettlebell"],"obliques, grip","One weight, don't lean.",{unit:"sec",reps:[30,45],per:"side"});
// Conditioning (finishers and conditioning days)
E("battle_rope","Battle Rope Intervals","cond",3,"bw",["battle_rope"],"conditioning","Double waves, slams, alternating waves.",{cond:"8 rounds: 20 s hard / 40 s easy"});
E("row_intervals","Rower Intervals","cond",3,"bw",["rower"],"conditioning","Legs, then body, then arms.",{cond:"6 × 250 m hard, 1 min rest"});
E("bike_intervals","Bike Intervals","cond",3,"bw",["bike"],"conditioning","Seat at hip height.",{cond:"10 rounds: 20 s sprint / 40 s easy"});
E("jump_rope","Jump Rope","cond",3,"bw",["jump_rope"],"conditioning","Small hops, wrists turn the rope.",{cond:"10 rounds: 45 s on / 15 s off"});
E("kb_swing_cond","Kettlebell Swing EMOM","cond",3,"kb",["kettlebell"],"conditioning","Snap the hips.",{cond:"10 min: 15 swings every minute"});
E("sled_push","Sled Push","cond",3,"bw",["sled"],"conditioning","Low body angle, drive.",{cond:"8 × 20 m, walk back to rest"});
E("incline_walk","Incline Treadmill Walk","cond",3,"bw",["treadmill"],"conditioning","No holding the rails.",{cond:"20 min at 10–12% incline, brisk pace"});
E("ball_slam","Med Ball Slams","cond",3,"bw",["med_ball"],"conditioning","Reach tall, slam hard.",{cond:"6 rounds: 30 s on / 30 s off"});
E("burpee","Burpee Intervals","cond",3,"bw",[],"conditioning","Chest to floor, jump at the top.",{cond:"8 rounds: 20 s on / 40 s off"});
E("db_complex","Dumbbell Complex","cond",3,"db",["dumbbells"],"conditioning","Light dumbbells: 6 RDL, 6 rows, 6 squats, 6 presses without putting them down.",{cond:"4 rounds, 90 s rest"});
E("lm_thruster","Landmine Thruster Circuit","cond",3,"lm",["landmine","barbell"],"conditioning","Squat and press in one motion.",{cond:"5 rounds: 10 thrusters + 30 s rest"});

export const EXERCISES = X;
export const EX = Object.fromEntries(X.map(e => [e.id, e]));
export const PATTERN_LABEL = { squat:"Squat", hinge:"Hinge", lunge:"Single-leg", h_push:"Horizontal push", v_push:"Vertical push", h_pull:"Horizontal pull", v_pull:"Vertical pull", quad_iso:"Quads", ham_iso:"Hamstrings", glute:"Glutes", calf:"Calves", chest_iso:"Chest", lat_delt:"Side delts", rear_delt:"Rear delts", biceps:"Biceps", triceps:"Triceps", core_flex:"Abs", core_anti:"Core stability", cond:"Conditioning" };
export const MUSCLE_OF_PATTERN = { squat:"Quads", hinge:"Hamstrings & glutes", lunge:"Quads", h_push:"Chest", v_push:"Shoulders", h_pull:"Back", v_pull:"Back", quad_iso:"Quads", ham_iso:"Hamstrings & glutes", glute:"Hamstrings & glutes", calf:"Calves", chest_iso:"Chest", lat_delt:"Shoulders", rear_delt:"Shoulders", biceps:"Arms", triceps:"Arms", core_flex:"Core", core_anti:"Core" };

export function hasEq(ex, eq) {
  const own = new Set(eq);
  return ex.req.every(r => r.split("|").some(x => own.has(x)));
}
export function available(eq) { return X.filter(e => hasEq(e, eq)); }
export function alternatives(id, eq) {
  const e = EX[id]; if (!e) return [];
  return X.filter(x => x.id !== id && x.pattern === e.pattern && hasEq(x, eq));
}
export function videoUrl(e) { return "https://www.youtube.com/results?search_query=" + encodeURIComponent("how to " + e.name + " proper form"); }

/* ---------- Program generator ---------- */
const SCHEMES = {
  strength:   { 1: [5,3,5,180], 2: [3,6,8,120], 3: [3,8,12,75] },
  hypertrophy:{ 1: [4,6,10,150], 2: [3,8,12,105], 3: [3,12,15,60] },
  recomp:     { 1: [4,5,8,150], 2: [3,8,12,105], 3: [3,10,15,60] },
  fatloss:    { 1: [3,6,10,120], 2: [3,10,12,90], 3: [3,12,15,45] },
  athletic:   { 1: [4,3,6,150], 2: [3,6,10,105], 3: [2,10,15,60] }
};
export const GOALS = { recomp: "Recomp: lose fat and build muscle", hypertrophy: "Build muscle", strength: "Get stronger", fatloss: "Lose fat fast", athletic: "Athletic / general fitness" };
// Day templates: slot = [pattern, tier]
const T = {
  fbA: { name: "Full Body A", sub: "Squat + press", slots: [["squat",1],["h_push",1],["h_pull",2],["hinge",2],["v_push",2],["core_flex",3],["biceps",3],["calf",3]] },
  fbB: { name: "Full Body B", sub: "Hinge + pull", slots: [["hinge",1],["v_pull",1],["v_push",2],["lunge",2],["h_push",2],["rear_delt",3],["core_anti",3],["triceps",3]] },
  fbC: { name: "Full Body C", sub: "Volume", slots: [["squat",2],["h_pull",2],["h_push",2],["glute",3],["lat_delt",3],["ham_iso",3],["biceps",3],["triceps",3]] },
  upS: { name: "Upper A", sub: "Strength", slots: [["h_push",1],["h_pull",2],["v_push",2],["v_pull",2],["rear_delt",3],["triceps",3],["biceps",3],["chest_iso",3]] },
  loS: { name: "Lower A", sub: "Squat focus", slots: [["squat",1],["hinge",2],["lunge",2],["ham_iso",3],["calf",3],["core_flex",3],["quad_iso",3]] },
  upV: { name: "Upper B", sub: "Volume", slots: [["v_pull",2],["h_push",2],["h_pull",2],["v_push",2],["lat_delt",3],["chest_iso",3],["biceps",3],["triceps",3]] },
  loV: { name: "Lower B", sub: "Hinge focus", slots: [["hinge",1],["squat",2],["lunge",2],["glute",3],["ham_iso",3],["calf",3],["core_anti",3]] },
  push: { name: "Push", sub: "Chest, shoulders, triceps", slots: [["h_push",1],["v_push",2],["h_push",2],["chest_iso",3],["lat_delt",3],["triceps",3],["triceps",3]] },
  pull: { name: "Pull", sub: "Back, biceps", slots: [["v_pull",1],["h_pull",2],["h_pull",2],["rear_delt",3],["biceps",3],["biceps",3],["core_flex",3]] },
  legs: { name: "Legs", sub: "Quads, hams, glutes", slots: [["squat",1],["hinge",2],["lunge",2],["quad_iso",3],["ham_iso",3],["calf",3],["core_anti",3]] }
};
const SPLITS = {
  2: { name: "2-day full body", days: ["fbA","fbB"], dow: [1,4] },
  3: { name: "3-day full body", days: ["fbA","fbB","fbC"], dow: [1,3,5] },
  4: { name: "4-day upper/lower", days: ["upS","loS","upV","loV"], dow: [1,2,4,5] },
  5: { name: "5-day upper/lower + push/pull/legs", days: ["upS","loS","push","pull","legs"], dow: [1,2,3,5,6] },
  6: { name: "6-day push/pull/legs", days: ["push","pull","legs","push","pull","legs"], dow: [1,2,3,4,5,6] }
};
const FALLBACK = { v_pull: ["h_pull"], h_pull: ["v_pull"], squat: ["lunge"], hinge: ["glute"], quad_iso: ["lunge","squat"], ham_iso: ["hinge"], chest_iso: ["h_push"], lat_delt: ["v_push"], rear_delt: ["h_pull"], glute: ["hinge"], v_push: ["h_push"] };
const LIMIT = { 30: 4, 45: 5, 60: 6, 75: 7, 90: 8 };

function pickExercise(pattern, tier, eq, used, variant, avoid) {
  const tryPattern = p => {
    let c = X.filter(e => e.pattern === p && hasEq(e, eq) && !avoid.has(e.id));
    if (!c.length) return null;
    if (tier === 1) { const t12 = c.filter(e => e.tier <= 2); if (t12.length) c = t12; }
    c.sort((a, b) => (Math.abs(a.tier - tier) - Math.abs(b.tier - tier)) || ((used.get(a.id) || 0) - (used.get(b.id) || 0)) || (X.indexOf(a) - X.indexOf(b)));
    const best = c.filter(e => Math.abs(e.tier - tier) === Math.abs(c[0].tier - tier));
    return best[variant % best.length];
  };
  let e = tryPattern(pattern);
  if (!e) for (const f of FALLBACK[pattern] || []) { e = tryPattern(f); if (e) break; }
  return e;
}
function scheme(goal, tier, ex, level) {
  let [sets, lo, hi, rest] = SCHEMES[goal][Math.min(3, Math.max(1, tier))];
  if (level === "beginner" && sets > 3) sets = 3;
  if (level === "advanced" && tier > 1) sets += 1;
  if (ex.reps) { lo = ex.reps[0]; hi = ex.reps[1]; }
  return { sets, lo, hi, rest };
}
function condDay(eq) {
  const c = X.filter(e => e.pattern === "cond" && hasEq(e, eq));
  const items = [];
  items.push("Warm-up: 5 min easy movement and dynamic stretching");
  c.slice(0, 2).forEach(e => items.push(`${e.name}: ${e.cond}`));
  if (!c.length) items.push("Burpee intervals: 8 rounds of 20 s on / 40 s off");
  items.push(eq.includes("mat") ? "Yoga flow on the mat: 15 min (cat-cow, world's greatest stretch, pigeon, thread-the-needle)" : "Mobility: 15 min of hips, hamstrings and shoulders");
  return { id: "cond", name: "Conditioning", sub: "Intervals + mobility", kind: "chk", checklist: items };
}
function recoveryDay(eq) {
  const items = [eq.includes("mat") ? `Yoga flow: 25 min${eq.includes("blocks") ? " with blocks" : ""}` : "Mobility flow: 25 min"];
  if (eq.includes("pullup_bar")) items.push("Dead hang: 3 × 30–45 s");
  if (eq.includes("foam_roller")) items.push("Foam roll: 10 min (quads, upper back, lats)");
  items.push("Easy walk: 20+ min");
  return { id: "rec", name: "Recovery", sub: "Mobility", kind: "chk", checklist: items };
}
const OUTDOOR = { id: "out", name: "Outdoor", sub: "Zone 2", kind: "chk", checklist: ["45–60 min outdoor cardio at a nose-breathing pace: brisk walk, hike, ruck or bike", "Mobility: 10 min, hips and shoulders"] };

export function generateProgram(p) {
  const eq = p.equipment || [];
  const days = Math.min(6, Math.max(2, +p.days || 4));
  const goal = SCHEMES[p.goal] ? p.goal : "recomp";
  const level = p.level || "intermediate";
  const cap = LIMIT[p.minutes] || 6;
  const split = SPLITS[days];
  const used = new Map(); const tCount = {};
  const out = [];
  split.days.forEach((tid, i) => {
    const tpl = T[tid]; tCount[tid] = (tCount[tid] || 0) + 1; const variant = tCount[tid] - 1;
    const items = []; const avoid = new Set();
    for (const [pattern, tier] of tpl.slots) {
      if (items.length >= cap) break;
      const e = pickExercise(pattern, tier, eq, used, variant, avoid);
      if (!e) continue;
      avoid.add(e.id); used.set(e.id, (used.get(e.id) || 0) + 1);
      const s = scheme(goal, Math.max(tier, e.tier === 3 ? 3 : tier), e, level);
      items.push({ ex: e.id, ...s });
    }
    const fin = (goal === "fatloss" || goal === "recomp" || goal === "athletic") ? X.find(e => e.pattern === "cond" && hasEq(e, eq)) : null;
    out.push({ id: "d" + (i + 1), name: tpl.name + (variant ? " (2)" : ""), sub: tpl.sub, kind: "lift", items, finisher: fin ? `${fin.name}: ${fin.cond}` : "" });
  });
  const schedule = {}; for (let d = 0; d < 7; d++) schedule[d] = null;
  split.dow.forEach((d, i) => { schedule[d] = out[i].id; });
  const extras = [condDay(eq), recoveryDay(eq), OUTDOOR];
  for (let d = 1; d <= 6; d++) if (!schedule[d]) schedule[d] = (d === 6 ? "out" : "cond");
  if (!schedule[0]) schedule[0] = "rec";
  return { name: `${split.name} · ${GOALS[goal].split(":")[0]}`, generated: true, goal, level, days: [...out, ...extras], schedule, deloadEvery: level === "beginner" ? 6 : 4 };
}

/* Periodization: 4-week blocks. Rep targets shift down a little each block on main lifts. */
export function blockAdjust(item, week, deloadEvery) {
  const ex = EX[item.ex]; const it = { ...item };
  const de = deloadEvery || 4;
  const deload = week % de === 0;
  const block = Math.floor((week - 1) / de);
  if (!deload && ex && ex.tier <= 2 && !ex.reps && block % 3 > 0) {
    const shift = (block % 3) * (ex.tier === 1 ? 1 : 0.5);
    it.lo = Math.max(3, Math.round(it.lo - shift)); it.hi = Math.max(it.lo, Math.round(it.hi - shift));
  }
  if (deload) it.sets = Math.max(2, it.sets - 1);
  return { ...it, deload, block: block + 1 };
}

/* Weight steps for suggestions */
export function nextWeight(w, ex, gear) {
  if (ex.load === "db") {
    const k = DB_KINDS[gear.dbKind] || DB_KINDS.fixed5;
    if (k.steps && k.steps.length) { const n = k.steps.find(x => x > w); return n === undefined ? w : n; }
    return Math.min(gear.dbMax || 999, w + (k.step || 5));
  }
  if (ex.load === "bb") return w + (["squat","hinge"].includes(ex.pattern) ? 10 : 5);
  if (ex.load === "bw") return w + 5;
  return w + 5;
}
export function deloadWeight(w, ex, gear) {
  if (ex.load === "db") {
    const k = DB_KINDS[gear.dbKind] || DB_KINDS.fixed5;
    if (k.steps && k.steps.length) { const l = k.steps.filter(x => x <= w * 0.9); return l.length ? l[l.length - 1] : k.steps[0]; }
    return Math.max(0, Math.round(w * 0.9 / (k.step || 5)) * (k.step || 5));
  }
  return Math.round(w * 0.9 / 5) * 5;
}
export function platesFor(total, bar, plates) {
  let side = (total - bar) / 2; if (side <= 0) return [];
  const out = []; const ps = [...plates].sort((a, b) => b - a);
  for (const p of ps) { while (side >= p - 1e-9) { out.push(p); side -= p; } }
  return side > 0.01 ? null : out;
}
