// @ts-check
/**
 * The five sample pages from the prototype, used as the boot deck in
 * milestone 1 and as test fixtures throughout. Their hues are hand-set — the
 * values an embedding model would produce — so tests treat them as targets
 * for the bag-of-words classifier, not as exact truths.
 * @type {import("./types.js").Page[]}
 */
export const SEED = [
  { q: "How do Smart Queues work in UniFi, and why would I turn them on in a business network?",
    a: [
      "Smart Queues is UniFi's name for SQM, smart queue management, running on the gateway. You tell it the real upload and download rate of the line, usually 85 to 95 percent of what a clean speed test shows. The gateway then shapes traffic to stay just under that rate, so the queue builds up in a place it controls rather than in the modem or the ISP's equipment, where it cannot see it.",
      "Inside that shaped queue it runs fq_codel: traffic is hashed into many small per-flow queues, and each one is policed by CoDel, which drops or marks packets when they have been waiting too long. The effect is that a big download cannot fill a buffer and make everyone else wait behind it. That buffer-filling is bufferbloat, and it is what makes a VoIP call stutter the moment someone starts a backup.",
      "In a business network that is the whole case: predictable latency under load for calls, video meetings, and remote desktop. The cost is CPU. Shaping every packet means the gateway cannot use hardware offload, so an older USG tops out well under its rated throughput with Smart Queues on, and even a UDM Pro will not shape a full gigabit. On a line of a few hundred megabits it is almost always worth it."
    ].join("\n\n"),
    ang: 222, r: 0.92, near: null, sim: null },
  { q: "How does the CoDel bucket actually work?",
    a: [
      "CoDel stands for controlled delay, and the trick is that it never looks at how full the queue is. It timestamps every packet on the way in and measures sojourn time, how long each packet sat, on the way out. A deep queue that drains fast is fine; a short queue that drains slowly is the problem.",
      "It watches the minimum sojourn time over an interval, 100 ms by default. If even the luckiest packet in that window waited longer than the target, 5 ms, the queue is standing rather than bursting, and CoDel enters its dropping state. It drops one packet, then schedules the next drop at interval divided by the square root of the drop count, so drops come faster and faster until the minimum delay falls back under target. Then it backs off and waits again.",
      "The fq in fq_codel adds flow queueing in front of that: packets are hashed by five-tuple into around a thousand queues, served round-robin with a deficit counter, and each queue gets its own CoDel. So a greedy flow only ever punishes itself. Sparse flows, like a DNS lookup or a game packet, get a slight priority because the round robin reaches them before the fat flows have used their quantum."
    ].join("\n\n"),
    ang: 229, r: 0.96, near: 0, sim: 0.64 },
  { q: "What's a sane VLAN layout for a 40-person office?",
    a: [
      "Four or five VLANs covers almost every office of that size. Staff devices on one. Printers, cameras, door controllers, and anything else that will never get a security patch on an IoT or devices VLAN with no route to the staff network except through explicitly allowed ports. Guest Wi-Fi on its own, isolated from everything but the internet. Management for switches, APs, and the gateway itself, reachable only from a small admin subnet.",
      "Resist the urge to split staff by department. The isolation rarely buys anything and you will spend the next two years writing exceptions. Where you do want a boundary is around the things that get compromised first: cheap IoT gear and guest laptops. Everything else is a firewall rule, not a VLAN.",
      "Tag the uplinks, leave the access ports untagged on the staff VLAN, and write the rules in one direction: new VLANs start with deny, then you add what they need."
    ].join("\n\n"),
    ang: 196, r: 0.70, near: 0, sim: 0.31 },
  { q: "Why does my sourdough starter smell like nail-polish remover?",
    a: [
      "That acetone smell means the starter is hungry. When the yeast run out of sugars they shift metabolism and the culture starts producing ethyl acetate and other esters, which read to the nose as nail-polish remover or overripe fruit. A grey liquid on top, hooch, usually shows up at the same time.",
      "It is not spoiled. Pour off the hooch or stir it back in, discard most of the starter, and feed it at a higher ratio than usual, something like 1:2:2 by weight. Two or three feeds on schedule and the smell goes back to sour and yeasty. If it is happening every day, feed more often or keep it a little cooler. Dough mixed with a starter in this state will still rise, but it proofs slowly and bakes flat, so wait a feed or two before baking."
    ].join("\n\n"),
    ang: 42, r: 0.88, near: 2, sim: 0.04, novel: true },
  { q: "On symmetric fiber, should I lower the fq_codel target below 5 ms?",
    a: [
      "Probably not. The 5 ms target and 100 ms interval were chosen to work across typical internet RTTs; the interval needs to be longer than the round trip for a flow to react to a drop, and the target is set to be a small fraction of that. On a fast, low-latency link the defaults still behave well, and the gains from shaving the target are measured in fractions of a millisecond.",
      "What does matter at high rates is the bandwidth setting on the shaper, and the quantum. If the shaper is set too close to line rate, the upstream buffer fills and fq_codel never gets a chance; set it a few percent under. At gigabit rates the default quantum of 1514 bytes is fine. Lowering target below the serialization time of a single large packet, which at 1 Gbps is about 12 microseconds, is pointless, and below about 1 ms it starts to cause unnecessary drops on bursty flows.",
      "If you want to tune something, tune the shaper rate and verify with a bufferbloat test under load. Leave the CoDel constants alone."
    ].join("\n\n"),
    ang: 226, r: 0.90, near: 1, sim: 0.58 },
];
