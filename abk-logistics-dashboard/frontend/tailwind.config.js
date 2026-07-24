/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        abk: {
          navy: "#13233F",
          navy2: "#1E355C",
          gold: "#D4A017",
        },
        status: {
          hit: "#28a745",
          miss: "#DC143C",
          rts: "#FF8C00",
          intransit: "#FFBF00",
          ofd: "#FFD700",
          delivered: "#28a745",
          exception: "#6D0F35",
          ndr: "#6D0F35",
        },
      },
    },
  },
  plugins: [],
};
