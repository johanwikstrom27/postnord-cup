export const DEFAULT_FINAL_START_SCORES = [-10, -8, -6, -5, -4, -3, -2, -1, 0];

export type StadgarContentFields = {
  stadgar_header_description: string | null;
  stadgar_general_title: string | null;
  stadgar_general_items: string | null;
  stadgar_trackman_title: string | null;
  stadgar_trackman_items: string | null;
  stadgar_extra_title: string | null;
  stadgar_extra_body: string | null;
  stadgar_hcp_title: string | null;
  stadgar_hcp_intro: string | null;
  stadgar_final_title: string | null;
  stadgar_final_intro: string | null;
  stadgar_points_title: string | null;
  stadgar_points_intro: string | null;
  stadgar_regular_points_title: string | null;
  stadgar_major_points_title: string | null;
  stadgar_team_points_title: string | null;
  stadgar_team_points_note: string | null;
};

export const DEFAULT_STADGAR_CONTENT: Record<keyof StadgarContentFields, string> = {
  stadgar_header_description: "Sammanställning av regler, HCP/PN-HCP, finalens startscore och poängfördelning.",
  stadgar_general_title: "Stadgar",
  stadgar_general_items: [
    "Alla är inbjudna till varje tävling.",
    "Vid utebliven närvaro delas inga poäng ut för spelaren.",
    "Av de vanliga tävlingarna räknas endast de bästa {{vanlig_best_of}} av 6 möjliga.",
    "Av major-tävlingarna räknas endast de bästa {{major_best_of}} av 4 möjliga.",
    "Av lagtävlingarna (2v2) räknas de bästa {{lagtavling_best_of}} av 2 möjliga. Lagen slumpas till dessa tävlingar.",
    "Vid delad förstaplats i någon tävling blir det särspel (puttävling, bäst av 3).",
    "Vid oavgjort på andra placeringar får båda spelarna den högre poängen.",
    "Maximalt 14 klubbor i bagen.",
  ].join("\n"),
  stadgar_trackman_title: "Trackmanregler",
  stadgar_trackman_items: [
    "Samtliga tävlingar spelas med puttning: Auto – Fixed.",
    "Inga mulligans.",
    "Slår man en socket som ej registreras måste man visa tacksamhet.",
    "Samtliga spelare väljer tees, pins & vind enligt fliken för aktuella tävlingen.",
  ].join("\n"),
  stadgar_extra_title: "",
  stadgar_extra_body: "",
  stadgar_hcp_title: "Spelare & PN-HCP",
  stadgar_hcp_intro:
    "PN-HCP = antal slag per tävling enligt säsongens HCP-gränser:\n0–{{hcp_zero_max}} ⇒ 0 slag, {{hcp_zero_max_plus}}–{{hcp_two_max}} ⇒ 2 slag, {{hcp_four_min}}+ ⇒ 4 slag.",
  stadgar_final_title: "Startscore inför Final",
  stadgar_final_intro:
    "Startscore = Serieplacering inkl. PN-HCP (0/2/4 slag).\nT.ex. 1:an startar på {{final_rank_1}} och om PN-HCP är 2 slag = Startscore {{final_rank_1_with_two}}.",
  stadgar_points_title: "Poängfördelning",
  stadgar_points_intro:
    "I varje tävling koras en vinnare, direkt eller via särspel. T.ex. tre spelare delar bästa nettoscore, särspel avgör plats nr 1 och övriga två spelare tilldelas poängen för plats nr 2. Fjärde bästa spelaren tilldelas plats nr 4 och poäng därefter.",
  stadgar_regular_points_title: "PostNord Cup-tävlingar (Vanlig)",
  stadgar_major_points_title: "Major-tävlingar",
  stadgar_team_points_title: "Lagtävling (2v2)",
  stadgar_team_points_note: "Poäng per spelare i laget.",
};

export const STADGAR_TEMPLATE_TOKENS = [
  "{{vanlig_best_of}}",
  "{{major_best_of}}",
  "{{lagtavling_best_of}}",
  "{{hcp_zero_max}}",
  "{{hcp_zero_max_plus}}",
  "{{hcp_two_max}}",
  "{{hcp_four_min}}",
  "{{final_rank_1}}",
  "{{final_rank_1_with_two}}",
];

export function interpolateTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{([a-z0-9_]+)\}\}/gi, (match, key) => values[key] ?? match);
}

export function parseBulletList(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseParagraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function normalizeTextarea(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}
