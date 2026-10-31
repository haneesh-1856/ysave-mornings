// Generated from drafts/ysave-style-lab.html by a one-off port script. Values are the design source of truth.
// Edit here from now on; keep in sync with docs/06-design-system.md.

export const palettes = {
  "mist": {
    "name": "Mist",
    "bg": "#f4f6f6",
    "surface": "#ffffff",
    "ink": "#233036",
    "muted": "#5d6a70",
    "line": "#e2e8ea",
    "accent": "#397c68",
    "danger": "#a8322a",
    "dangerFill": "#a8322a",
    "on": "#ffffff",
    "study": "#8db8e6",
    "health": "#86cfa9",
    "home": "#f1ad86",
    "c4": "#c3b2ec",
    "c5": "#f2a7c3",
    "sun": "#f2b257",
    "tint1": "#e1edfb",
    "tint2": "#fbf0d6",
    "tint3": "#e3f1eb",
    "frame": "#1d2226"
  },
  "sunrise": {
    "name": "Sunrise",
    "bg": "#fff6f2",
    "surface": "#ffffff",
    "ink": "#3b2b2b",
    "muted": "#776461",
    "line": "#f3e1d9",
    "accent": "#af5a3f",
    "danger": "#a8322a",
    "dangerFill": "#a8322a",
    "on": "#ffffff",
    "study": "#9db6f0",
    "health": "#95d4b4",
    "home": "#f7c45c",
    "c4": "#c7b4f0",
    "c5": "#7fd0d6",
    "sun": "#f7a94b",
    "tint1": "#ffe6dc",
    "tint2": "#fff0cf",
    "tint3": "#fde3e8",
    "frame": "#2a1f1f"
  },
  "lagoon": {
    "name": "Lagoon",
    "bg": "#f0f7fa",
    "surface": "#ffffff",
    "ink": "#13303d",
    "muted": "#516c79",
    "line": "#d9e8ee",
    "accent": "#197a96",
    "danger": "#a8322a",
    "dangerFill": "#a8322a",
    "on": "#ffffff",
    "study": "#6aa7e8",
    "health": "#4cc2a4",
    "home": "#f3a76b",
    "c4": "#b9a6ee",
    "c5": "#f59fb6",
    "sun": "#ffc85a",
    "tint1": "#d8eff7",
    "tint2": "#fff1cf",
    "tint3": "#d9f4ec",
    "frame": "#0f2630"
  },
  "lavender": {
    "name": "Lavender",
    "bg": "#f7f5fc",
    "surface": "#ffffff",
    "ink": "#2e2840",
    "muted": "#6a647e",
    "line": "#e7e2f3",
    "accent": "#765ecd",
    "danger": "#a8322a",
    "dangerFill": "#a8322a",
    "on": "#ffffff",
    "study": "#9ab5f2",
    "health": "#8fd6c0",
    "home": "#f5b0c6",
    "c4": "#f6b98a",
    "c5": "#7cc7e0",
    "sun": "#f6c76a",
    "tint1": "#ebe5fb",
    "tint2": "#fdf0d9",
    "tint3": "#e1f5ef",
    "frame": "#221d33"
  },
  "mono": {
    "name": "Paper mono",
    "bg": "#f6f6f3",
    "surface": "#ffffff",
    "ink": "#161616",
    "muted": "#60605a",
    "line": "#e3e3de",
    "accent": "#161616",
    "danger": "#a8322a",
    "dangerFill": "#a8322a",
    "on": "#ffffff",
    "study": "#5b8def",
    "health": "#3fbf8f",
    "home": "#f28c5c",
    "c4": "#a77ce8",
    "c5": "#e8607f",
    "sun": "#f5c044",
    "tint1": "#ecece6",
    "tint2": "#f4f0e2",
    "tint3": "#e6f2ec",
    "frame": "#161616"
  },
  "night": {
    "name": "Night owl",
    "bg": "#12151c",
    "surface": "#1c2029",
    "ink": "#e8ebf2",
    "muted": "#b8becb",
    "line": "#2a303c",
    "accent": "#8fd3c0",
    "danger": "#ffb0a8",
    "dangerFill": "#a8322a",
    "on": "#0f1d1a",
    "study": "#6f9ee0",
    "health": "#5fc39a",
    "home": "#e59a6e",
    "c4": "#a58ee0",
    "c5": "#e07fa0",
    "sun": "#f0b860",
    "tint1": "#1c2a3d",
    "tint2": "#33291a",
    "tint3": "#173029",
    "frame": "#05070a"
  }
} as const;

export const fonts = {
  "jakarta": {
    "name": "Friendly",
    "fam": "\"Plus Jakarta Sans\", system-ui, sans-serif",
    "sample": "Plus Jakarta Sans"
  },
  "nunito": {
    "name": "Rounded",
    "fam": "Nunito, system-ui, sans-serif",
    "sample": "Nunito"
  },
  "fraunces": {
    "name": "Soft serif",
    "fam": "Fraunces, Georgia, serif",
    "sample": "Fraunces"
  },
  "bricolage": {
    "name": "Quirky",
    "fam": "\"Bricolage Grotesque\", system-ui, sans-serif",
    "sample": "Bricolage Grotesque"
  },
  "plex": {
    "name": "Notebook mono",
    "fam": "\"IBM Plex Mono\", ui-monospace, monospace",
    "sample": "IBM Plex Mono"
  }
} as const;

export const shapes = {
  "soft": {
    "name": "Soft",
    "r": "16px",
    "rb": "999px"
  },
  "round": {
    "name": "Extra round",
    "r": "26px",
    "rb": "999px"
  },
  "crisp": {
    "name": "Crisp",
    "r": "6px",
    "rb": "8px"
  },
  "square": {
    "name": "Square",
    "r": "2px",
    "rb": "2px"
  }
} as const;

export const surfaces = {
  "flat": "Flat lines",
  "raised": "Soft shadows",
  "outline": "Bold outline",
  "glass": "Frosted glass"
} as const;

export const glassTints = {
  "match": {
    "name": "Match the palette",
    "b": [
      "var(--p-tint1)",
      "var(--p-tint2)",
      "var(--p-tint3)"
    ],
    "bs": "100%",
    "tone": "var(--p-surface)",
    "tm": "0%",
    "a": "55%"
  },
  "aurora": {
    "name": "Aurora",
    "b": [
      "#5fd6b8",
      "#9f86f5",
      "#f59cc8"
    ],
    "bs": "60%",
    "tone": "#7a5cf0",
    "tm": "10%",
    "a": "55%"
  },
  "peach": {
    "name": "Peach haze",
    "b": [
      "#ffaa88",
      "#ffd166",
      "#ff8fab"
    ],
    "bs": "60%",
    "tone": "#ff8a5c",
    "tm": "12%",
    "a": "55%"
  },
  "sea": {
    "name": "Sea glass",
    "b": [
      "#5bbcec",
      "#6fdcc0",
      "#9cc4ff"
    ],
    "bs": "60%",
    "tone": "#3aa7c9",
    "tm": "12%",
    "a": "55%"
  },
  "dusk": {
    "name": "Dusk",
    "b": [
      "#b69bff",
      "#ff94bd",
      "#7f9cff"
    ],
    "bs": "60%",
    "tone": "#8a6cf0",
    "tm": "12%",
    "a": "55%"
  },
  "mint": {
    "name": "Mint frost",
    "b": [
      "#8be3c4",
      "#c8f08f",
      "#7fd3e6"
    ],
    "bs": "55%",
    "tone": "#3fbf8f",
    "tm": "12%",
    "a": "55%"
  },
  "clear": {
    "name": "Clear ice",
    "b": [
      "#cfd8e3",
      "#e6ebf1",
      "#c4d0de"
    ],
    "bs": "70%",
    "tone": "var(--p-surface)",
    "tm": "0%",
    "a": "55%"
  },
  "smoke": {
    "name": "Smoked",
    "b": [
      "#9aa3b2",
      "#c9ced6",
      "#7d8796"
    ],
    "bs": "55%",
    "tone": "#0b0f17",
    "tm": "10%",
    "a": "55%"
  },
  "accent": {
    "name": "Accent tint",
    "b": [
      "var(--p-tint1)",
      "var(--p-tint2)",
      "var(--p-tint3)"
    ],
    "bs": "100%",
    "tone": "var(--p-accent)",
    "tm": "16%",
    "a": "55%"
  },
  "milk": {
    "name": "Milk glass",
    "b": [
      "var(--p-tint1)",
      "var(--p-tint2)",
      "var(--p-tint3)"
    ],
    "bs": "100%",
    "tone": "var(--p-surface)",
    "tm": "0%",
    "a": "80%"
  },
  "prism": {
    "name": "Prism",
    "b": [
      "#ff8a8a",
      "#8affc1",
      "#8ab8ff"
    ],
    "bs": "55%",
    "tone": "var(--p-surface)",
    "tm": "0%",
    "a": "50%"
  },
  "sunset": {
    "name": "Sunset",
    "b": [
      "#ff7e5f",
      "#feb47b",
      "#ff6a88"
    ],
    "bs": "55%",
    "tone": "#ff6a3d",
    "tm": "10%",
    "a": "55%"
  },
  "golden": {
    "name": "Golden hour",
    "b": [
      "#ffc46b",
      "#ff9a5a",
      "#ffe08a"
    ],
    "bs": "60%",
    "tone": "#f2a63a",
    "tm": "12%",
    "a": "55%"
  },
  "citrus": {
    "name": "Citrus",
    "b": [
      "#ffd84d",
      "#a8e063",
      "#ffa94d"
    ],
    "bs": "55%",
    "tone": "#e0a800",
    "tm": "10%",
    "a": "55%"
  },
  "ember": {
    "name": "Ember",
    "b": [
      "#ff6b3d",
      "#ffb238",
      "#d9381e"
    ],
    "bs": "45%",
    "tone": "#c2410c",
    "tm": "10%",
    "a": "55%"
  },
  "rose": {
    "name": "Rose quartz",
    "b": [
      "#f7a8b8",
      "#fbc8d4",
      "#e8a0c8"
    ],
    "bs": "65%",
    "tone": "#e07a99",
    "tm": "12%",
    "a": "55%"
  },
  "candy": {
    "name": "Cotton candy",
    "b": [
      "#ffb3d9",
      "#a6e3ff",
      "#d6b3ff"
    ],
    "bs": "65%",
    "tone": "#ff8cc6",
    "tm": "10%",
    "a": "55%"
  },
  "berry": {
    "name": "Berry",
    "b": [
      "#d16ba5",
      "#a874d8",
      "#ff8fb1"
    ],
    "bs": "50%",
    "tone": "#b04a9a",
    "tm": "12%",
    "a": "55%"
  },
  "lavfield": {
    "name": "Lavender field",
    "b": [
      "#b8a4f0",
      "#d4c4ff",
      "#9fb4f5"
    ],
    "bs": "65%",
    "tone": "#7b62d6",
    "tm": "12%",
    "a": "55%"
  },
  "arctic": {
    "name": "Arctic",
    "b": [
      "#bfe9ff",
      "#e0f7ff",
      "#a9d6f5"
    ],
    "bs": "70%",
    "tone": "#7cc7f0",
    "tm": "8%",
    "a": "55%"
  },
  "tropical": {
    "name": "Tropical",
    "b": [
      "#ffcc4d",
      "#2ec4b6",
      "#ff6f91"
    ],
    "bs": "50%",
    "tone": "#2ec4b6",
    "tm": "10%",
    "a": "55%"
  },
  "forest": {
    "name": "Forest",
    "b": [
      "#5fb37a",
      "#a3c96b",
      "#3f9e8a"
    ],
    "bs": "50%",
    "tone": "#2f7a52",
    "tm": "12%",
    "a": "55%"
  },
  "matcha": {
    "name": "Matcha latte",
    "b": [
      "#b5cf8a",
      "#e8dcc0",
      "#9cbf7a"
    ],
    "bs": "65%",
    "tone": "#6e8f3f",
    "tm": "10%",
    "a": "55%"
  },
  "mocha": {
    "name": "Mocha",
    "b": [
      "#c49a7a",
      "#e3c9a8",
      "#a77b5e"
    ],
    "bs": "55%",
    "tone": "#7a4f35",
    "tm": "10%",
    "a": "55%"
  },
  "deep": {
    "name": "Deep ocean",
    "b": [
      "#2f6fdb",
      "#1aa0b8",
      "#4b4fd1"
    ],
    "bs": "45%",
    "tone": "#1d4fa8",
    "tm": "14%",
    "a": "55%"
  },
  "midnight": {
    "name": "Midnight",
    "b": [
      "#3a3f8f",
      "#6b3fa0",
      "#1f5f8f"
    ],
    "bs": "45%",
    "tone": "#1a1f4a",
    "tm": "16%",
    "a": "55%"
  },
  "storm": {
    "name": "Storm",
    "b": [
      "#7d8fa8",
      "#a7b4c6",
      "#5d6f8a"
    ],
    "bs": "55%",
    "tone": "#3c4a5e",
    "tm": "12%",
    "a": "55%"
  },
  "neon": {
    "name": "Neon",
    "b": [
      "#00e5ff",
      "#ff2bd6",
      "#7cff4f"
    ],
    "bs": "45%",
    "tone": "#8a2bff",
    "tm": "10%",
    "a": "55%"
  }
} as const;

export const glassBlurs = {
  "thin": {
    "name": "Barely there",
    "px": "4px"
  },
  "soft": {
    "name": "Soft",
    "px": "8px"
  },
  "medium": {
    "name": "Medium",
    "px": "14px"
  },
  "heavy": {
    "name": "Heavy",
    "px": "24px"
  },
  "deep": {
    "name": "Deep frost",
    "px": "40px"
  }
} as const;

export const collectionLooks = {
  "glass": "Glass jar",
  "line": "Line-drawn jar",
  "paper": "Paper-cut jar",
  "garden": "Garden",
  "sky": "Constellation",
  "bracelet": "Bead bracelet",
  "cairn": "Stone cairn",
  "lights": "Fairy lights",
  "honey": "Honeycomb",
  "shelf": "Bookshelf",
  "plant": "Growing plant",
  "card": "Stamp card"
} as const;

export const collectionNouns = {
  "glass": [
    "jar",
    "marble"
  ],
  "line": [
    "jar",
    "marble"
  ],
  "paper": [
    "jar",
    "marble"
  ],
  "garden": [
    "garden",
    "flower"
  ],
  "sky": [
    "sky",
    "star"
  ],
  "bracelet": [
    "bracelet",
    "bead"
  ],
  "cairn": [
    "cairn",
    "stone"
  ],
  "lights": [
    "lights",
    "light"
  ],
  "honey": [
    "honeycomb",
    "cell"
  ],
  "shelf": [
    "shelf",
    "book"
  ],
  "plant": [
    "plant",
    "leaf"
  ],
  "card": [
    "stamp card",
    "stamp"
  ]
} as const;

export const motions = {
  "gentle": {
    "name": "Gentle",
    "dur": 420,
    "ease": "cubic-bezier(.2,.8,.2,1)"
  },
  "springy": {
    "name": "Springy",
    "dur": 650,
    "ease": "cubic-bezier(.34,1.56,.64,1)"
  },
  "crisp": {
    "name": "Snappy",
    "dur": 200,
    "ease": "cubic-bezier(.4,0,.2,1)"
  },
  "calm": {
    "name": "Slow and calm",
    "dur": 820,
    "ease": "cubic-bezier(.45,0,.25,1)"
  }
} as const;

export const transitions = {
  "slide": "Slide sideways",
  "fade": "Fade through",
  "expand": "Grow from the task",
  "rise": "Rise as a sheet"
} as const;

export const layouts = {
  "corner": "Jar in the corner",
  "hero": "Big jar on top",
  "dock": "Jar in a bottom dock"
} as const;

export const bars = {
  "seg": "15-min sections",
  "smooth": "One smooth bar",
  "thin": "Thin line, big number"
} as const;

export const navStyles = {
  "float": "Floating pill",
  "bar": "Full-width bar",
  "minimal": "Icons only"
} as const;

export const presets = [
  {
    "name": "Morning mist",
    "note": "Calm, clean, the current direction",
    "mix": {
      "pal": "mist",
      "font": "jakarta",
      "shape": "soft",
      "surf": "flat",
      "art": "glass",
      "motion": "gentle",
      "trans": "expand",
      "layout": "corner",
      "bar": "seg",
      "nav": "float",
      "glass": "match",
      "gblur": "medium"
    }
  },
  {
    "name": "Sunrise jam",
    "note": "Warm, round and bouncy",
    "mix": {
      "pal": "sunrise",
      "font": "nunito",
      "shape": "round",
      "surf": "raised",
      "art": "paper",
      "motion": "springy",
      "trans": "rise",
      "layout": "hero",
      "bar": "smooth",
      "nav": "bar",
      "glass": "match",
      "gblur": "medium"
    }
  },
  {
    "name": "Lagoon glass",
    "note": "Fresh, airy, frosted",
    "mix": {
      "pal": "lagoon",
      "font": "jakarta",
      "shape": "round",
      "surf": "glass",
      "art": "glass",
      "motion": "gentle",
      "trans": "fade",
      "layout": "dock",
      "bar": "smooth",
      "nav": "float",
      "glass": "match",
      "gblur": "medium"
    }
  },
  {
    "name": "Lavender journal",
    "note": "Soft serif, slow and thoughtful",
    "mix": {
      "pal": "lavender",
      "font": "fraunces",
      "shape": "soft",
      "surf": "flat",
      "art": "garden",
      "motion": "calm",
      "trans": "fade",
      "layout": "hero",
      "bar": "thin",
      "nav": "minimal",
      "glass": "match",
      "gblur": "medium"
    }
  },
  {
    "name": "Ink notebook",
    "note": "Paper, mono type, bold outlines",
    "mix": {
      "pal": "mono",
      "font": "plex",
      "shape": "square",
      "surf": "outline",
      "art": "line",
      "motion": "crisp",
      "trans": "slide",
      "layout": "corner",
      "bar": "seg",
      "nav": "bar",
      "glass": "match",
      "gblur": "medium"
    }
  },
  {
    "name": "Night owl",
    "note": "Dark and cozy for evenings",
    "mix": {
      "pal": "night",
      "font": "bricolage",
      "shape": "soft",
      "surf": "raised",
      "art": "glass",
      "motion": "gentle",
      "trans": "expand",
      "layout": "dock",
      "bar": "seg",
      "nav": "float",
      "glass": "match",
      "gblur": "medium"
    }
  }
] as const;
