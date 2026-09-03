/* ═══════════════════════════════════════════════════════════════════════
   SENTINELLE-RDC — DRC Gazetteer
   ═══════════════════════════════════════════════════════════════════════

   Why a gazetteer instead of `spacy.load("xx_ent_wiki_sm")`:

   A generic multilingual NER model tags "Kibumba", "Nyabiondo" and
   "Mweso" as O or PER far more often than LOC, because they appear in
   almost no pretraining corpus. It also cannot disambiguate "Kalehe"
   (territory) from "Kalehe-centre" (locality), and it has no notion that
   "Rutshuru" implies Nord-Kivu. For a *fixed area of responsibility*, a
   curated gazetteer with alias expansion beats a general model on both
   recall and precision, runs in microseconds, and needs no model download
   — which matters when the analyst laptop is on a 3G dongle in Goma.

   Each entry carries alias spellings actually seen in the wild: French
   press orthography, Swahili/Lingala renderings, accent-stripped social
   media forms, and the common transpositions ("Bukavou", "Butembu").
   ═══════════════════════════════════════════════════════════════════════ */

export type PlaceKind = 'city' | 'town' | 'locality' | 'territory' | 'province' | 'feature' | 'border' | 'camp';

export interface Place {
  name: string;
  lat: number;
  lon: number;
  province: string;
  territory?: string;
  kind: PlaceKind;
  /** Rough settlement population — drives population-at-risk when no
   *  raster sample is available. */
  pop?: number;
  /** Positional radius in km: how big is "this place"? */
  radius_km: number;
  aliases?: string[];
}

/* ── Eastern DRC — the operational AOR ──────────────────────────────── */

export const PLACES: Place[] = [
  /* ═══ NORD-KIVU ═══ */
  { name: 'Goma', lat: -1.678, lon: 29.228, province: 'Nord-Kivu', territory: 'Ville de Goma', kind: 'city', pop: 1_000_000, radius_km: 8, aliases: ['goma ville', 'ville de goma', 'gomà'] },
  { name: 'Kibumba', lat: -1.450, lon: 29.283, province: 'Nord-Kivu', territory: 'Nyiragongo', kind: 'locality', pop: 25_000, radius_km: 4, aliases: ['kibumba centre'] },
  { name: 'Nyiragongo', lat: -1.520, lon: 29.250, province: 'Nord-Kivu', territory: 'Nyiragongo', kind: 'territory', pop: 190_000, radius_km: 15, aliases: ['nyiragongo territoire', 'territoire de nyiragongo'] },
  { name: 'Kanyaruchinya', lat: -1.590, lon: 29.240, province: 'Nord-Kivu', territory: 'Nyiragongo', kind: 'camp', pop: 60_000, radius_km: 3, aliases: ['kanyarucinya', 'kanyaruchinya camp'] },
  { name: 'Munigi', lat: -1.615, lon: 29.253, province: 'Nord-Kivu', territory: 'Nyiragongo', kind: 'locality', pop: 30_000, radius_km: 3 },
  { name: 'Rutshuru', lat: -1.186, lon: 29.447, province: 'Nord-Kivu', territory: 'Rutshuru', kind: 'town', pop: 60_000, radius_km: 6, aliases: ['rutshuru centre', 'rutchuru'] },
  { name: 'Kiwanja', lat: -1.150, lon: 29.440, province: 'Nord-Kivu', territory: 'Rutshuru', kind: 'town', pop: 80_000, radius_km: 5, aliases: ['kiwandja'] },
  { name: 'Bunagana', lat: -1.340, lon: 29.630, province: 'Nord-Kivu', territory: 'Rutshuru', kind: 'border', pop: 30_000, radius_km: 3, aliases: ['bunagana frontiere', 'poste de bunagana'] },
  { name: 'Rumangabo', lat: -1.360, lon: 29.350, province: 'Nord-Kivu', territory: 'Rutshuru', kind: 'locality', pop: 15_000, radius_km: 4, aliases: ['camp rumangabo'] },
  { name: 'Rugari', lat: -1.398, lon: 29.320, province: 'Nord-Kivu', territory: 'Rutshuru', kind: 'locality', pop: 12_000, radius_km: 3 },
  { name: 'Tongo', lat: -1.020, lon: 29.090, province: 'Nord-Kivu', territory: 'Rutshuru', kind: 'locality', pop: 18_000, radius_km: 4 },
  { name: 'Nyamilima', lat: -0.930, lon: 29.550, province: 'Nord-Kivu', territory: 'Rutshuru', kind: 'locality', pop: 22_000, radius_km: 4 },
  { name: 'Ishasha', lat: -0.620, lon: 29.670, province: 'Nord-Kivu', territory: 'Rutshuru', kind: 'border', pop: 10_000, radius_km: 3, aliases: ['ishasha frontiere'] },
  { name: 'Mabenga', lat: -1.130, lon: 29.350, province: 'Nord-Kivu', territory: 'Rutshuru', kind: 'locality', pop: 8_000, radius_km: 3 },
  { name: 'Kibirizi', lat: -0.720, lon: 29.200, province: 'Nord-Kivu', territory: 'Rutshuru', kind: 'locality', pop: 20_000, radius_km: 4 },
  { name: 'Rwindi', lat: -0.780, lon: 29.280, province: 'Nord-Kivu', territory: 'Rutshuru', kind: 'locality', pop: 9_000, radius_km: 4 },
  { name: 'Vitshumbi', lat: -0.660, lon: 29.400, province: 'Nord-Kivu', territory: 'Rutshuru', kind: 'locality', pop: 15_000, radius_km: 3, aliases: ['vitshumbi peche'] },
  { name: 'Sake', lat: -1.573, lon: 28.990, province: 'Nord-Kivu', territory: 'Masisi', kind: 'town', pop: 60_000, radius_km: 5, aliases: ['sake centre'] },
  { name: 'Masisi', lat: -1.400, lon: 28.810, province: 'Nord-Kivu', territory: 'Masisi', kind: 'town', pop: 45_000, radius_km: 6, aliases: ['masisi centre', 'territoire de masisi'] },
  { name: 'Kitshanga', lat: -1.020, lon: 29.020, province: 'Nord-Kivu', territory: 'Masisi', kind: 'town', pop: 40_000, radius_km: 5, aliases: ['kitchanga', 'kichanga'] },
  { name: 'Mweso', lat: -0.970, lon: 28.920, province: 'Nord-Kivu', territory: 'Masisi', kind: 'locality', pop: 25_000, radius_km: 4, aliases: ['mwesso'] },
  { name: 'Nyabiondo', lat: -1.150, lon: 28.750, province: 'Nord-Kivu', territory: 'Masisi', kind: 'locality', pop: 20_000, radius_km: 4 },
  { name: 'Kilolirwe', lat: -1.230, lon: 29.030, province: 'Nord-Kivu', territory: 'Masisi', kind: 'locality', pop: 14_000, radius_km: 3, aliases: ['kilolirwe centre'] },
  { name: 'Karuba', lat: -1.520, lon: 28.900, province: 'Nord-Kivu', territory: 'Masisi', kind: 'locality', pop: 12_000, radius_km: 3 },
  { name: 'Mushaki', lat: -1.500, lon: 28.930, province: 'Nord-Kivu', territory: 'Masisi', kind: 'locality', pop: 10_000, radius_km: 3 },
  { name: 'Bihambwe', lat: -1.470, lon: 28.870, province: 'Nord-Kivu', territory: 'Masisi', kind: 'locality', pop: 9_000, radius_km: 3 },
  { name: 'Walikale', lat: -1.420, lon: 28.050, province: 'Nord-Kivu', territory: 'Walikale', kind: 'town', pop: 35_000, radius_km: 6, aliases: ['walikale centre'] },
  { name: 'Pinga', lat: -0.990, lon: 28.630, province: 'Nord-Kivu', territory: 'Walikale', kind: 'locality', pop: 18_000, radius_km: 4 },
  { name: 'Mubi', lat: -1.220, lon: 28.220, province: 'Nord-Kivu', territory: 'Walikale', kind: 'locality', pop: 15_000, radius_km: 4, aliases: ['mubi bakano'] },
  { name: 'Itebero', lat: -1.520, lon: 27.980, province: 'Nord-Kivu', territory: 'Walikale', kind: 'locality', pop: 11_000, radius_km: 4 },
  { name: 'Beni', lat: 0.492, lon: 29.472, province: 'Nord-Kivu', territory: 'Beni', kind: 'city', pop: 450_000, radius_km: 8, aliases: ['beni ville', 'ville de beni'] },
  { name: 'Oicha', lat: 0.700, lon: 29.520, province: 'Nord-Kivu', territory: 'Beni', kind: 'town', pop: 55_000, radius_km: 5, aliases: ['oitcha'] },
  { name: 'Mavivi', lat: 0.550, lon: 29.480, province: 'Nord-Kivu', territory: 'Beni', kind: 'locality', pop: 20_000, radius_km: 3 },
  { name: 'Eringeti', lat: 0.930, lon: 29.680, province: 'Nord-Kivu', territory: 'Beni', kind: 'locality', pop: 25_000, radius_km: 4, aliases: ['eringeti centre'] },
  { name: 'Kamango', lat: 0.790, lon: 29.940, province: 'Nord-Kivu', territory: 'Beni', kind: 'locality', pop: 18_000, radius_km: 4 },
  { name: 'Mutwanga', lat: 0.310, lon: 29.750, province: 'Nord-Kivu', territory: 'Beni', kind: 'locality', pop: 16_000, radius_km: 4 },
  { name: 'Kasindi', lat: 0.050, lon: 29.700, province: 'Nord-Kivu', territory: 'Beni', kind: 'border', pop: 30_000, radius_km: 4, aliases: ['kasindi frontiere', 'kasindi lubiriha'] },
  { name: 'Mbau', lat: 0.640, lon: 29.520, province: 'Nord-Kivu', territory: 'Beni', kind: 'locality', pop: 12_000, radius_km: 3 },
  { name: 'Butembo', lat: 0.131, lon: 29.291, province: 'Nord-Kivu', territory: 'Lubero', kind: 'city', pop: 350_000, radius_km: 7, aliases: ['butembu', 'ville de butembo'] },
  { name: 'Lubero', lat: -0.155, lon: 29.240, province: 'Nord-Kivu', territory: 'Lubero', kind: 'town', pop: 40_000, radius_km: 6, aliases: ['lubero centre'] },
  { name: 'Kanyabayonga', lat: -0.360, lon: 29.280, province: 'Nord-Kivu', territory: 'Lubero', kind: 'town', pop: 45_000, radius_km: 5, aliases: ['kanyabayonga centre'] },
  { name: 'Kayna', lat: -0.300, lon: 29.250, province: 'Nord-Kivu', territory: 'Lubero', kind: 'locality', pop: 30_000, radius_km: 4 },
  { name: 'Kirumba', lat: -0.420, lon: 29.280, province: 'Nord-Kivu', territory: 'Lubero', kind: 'locality', pop: 35_000, radius_km: 4 },
  { name: 'Alimbongo', lat: -0.180, lon: 29.130, province: 'Nord-Kivu', territory: 'Lubero', kind: 'locality', pop: 18_000, radius_km: 4 },
  { name: 'Bambo', lat: -0.900, lon: 29.150, province: 'Nord-Kivu', territory: 'Rutshuru', kind: 'locality', pop: 14_000, radius_km: 4, aliases: ['bambo bwito'] },

  /* ═══ SUD-KIVU ═══ */
  { name: 'Bukavu', lat: -2.508, lon: 28.842, province: 'Sud-Kivu', territory: 'Ville de Bukavu', kind: 'city', pop: 1_100_000, radius_km: 8, aliases: ['bukavou', 'ville de bukavu'] },
  { name: 'Uvira', lat: -3.400, lon: 29.140, province: 'Sud-Kivu', territory: 'Uvira', kind: 'city', pop: 640_000, radius_km: 7, aliases: ['uvira ville'] },
  { name: 'Sange', lat: -3.280, lon: 29.130, province: 'Sud-Kivu', territory: 'Uvira', kind: 'town', pop: 45_000, radius_km: 4 },
  { name: 'Luvungi', lat: -3.200, lon: 29.100, province: 'Sud-Kivu', territory: 'Uvira', kind: 'locality', pop: 30_000, radius_km: 4 },
  { name: 'Lemera', lat: -3.100, lon: 29.000, province: 'Sud-Kivu', territory: 'Uvira', kind: 'locality', pop: 22_000, radius_km: 4 },
  { name: 'Kiliba', lat: -3.290, lon: 29.230, province: 'Sud-Kivu', territory: 'Uvira', kind: 'border', pop: 25_000, radius_km: 3, aliases: ['kiliba ondes'] },
  { name: 'Baraka', lat: -4.100, lon: 29.090, province: 'Sud-Kivu', territory: 'Fizi', kind: 'town', pop: 120_000, radius_km: 5 },
  { name: 'Fizi', lat: -4.300, lon: 28.940, province: 'Sud-Kivu', territory: 'Fizi', kind: 'town', pop: 55_000, radius_km: 6, aliases: ['fizi centre'] },
  { name: 'Minembwe', lat: -4.030, lon: 28.720, province: 'Sud-Kivu', territory: 'Fizi', kind: 'locality', pop: 30_000, radius_km: 5, aliases: ['minembwe centre', 'hauts plateaux minembwe'] },
  { name: 'Misisi', lat: -4.440, lon: 28.780, province: 'Sud-Kivu', territory: 'Fizi', kind: 'locality', pop: 40_000, radius_km: 4, aliases: ['misisi mine'] },
  { name: 'Mwenga', lat: -3.040, lon: 28.430, province: 'Sud-Kivu', territory: 'Mwenga', kind: 'town', pop: 35_000, radius_km: 5 },
  { name: 'Kamituga', lat: -3.060, lon: 28.180, province: 'Sud-Kivu', territory: 'Mwenga', kind: 'town', pop: 110_000, radius_km: 5, aliases: ['kamituga mine'] },
  { name: 'Shabunda', lat: -2.700, lon: 27.350, province: 'Sud-Kivu', territory: 'Shabunda', kind: 'town', pop: 50_000, radius_km: 6 },
  { name: 'Kalehe', lat: -2.090, lon: 28.890, province: 'Sud-Kivu', territory: 'Kalehe', kind: 'town', pop: 40_000, radius_km: 6, aliases: ['kalehe centre'] },
  { name: 'Nyabibwe', lat: -2.020, lon: 28.940, province: 'Sud-Kivu', territory: 'Kalehe', kind: 'locality', pop: 25_000, radius_km: 4 },
  { name: 'Numbi', lat: -2.020, lon: 28.850, province: 'Sud-Kivu', territory: 'Kalehe', kind: 'locality', pop: 20_000, radius_km: 4, aliases: ['numbi mine'] },
  { name: 'Minova', lat: -1.980, lon: 29.030, province: 'Sud-Kivu', territory: 'Kalehe', kind: 'town', pop: 45_000, radius_km: 4 },
  { name: 'Bunyakiri', lat: -2.060, lon: 28.530, province: 'Sud-Kivu', territory: 'Kalehe', kind: 'locality', pop: 30_000, radius_km: 5 },
  { name: 'Hombo', lat: -1.910, lon: 28.420, province: 'Sud-Kivu', territory: 'Kalehe', kind: 'locality', pop: 18_000, radius_km: 4, aliases: ['hombo nord', 'hombo sud'] },
  { name: 'Katana', lat: -2.230, lon: 28.830, province: 'Sud-Kivu', territory: 'Kabare', kind: 'town', pop: 55_000, radius_km: 4 },
  { name: 'Kabare', lat: -2.500, lon: 28.800, province: 'Sud-Kivu', territory: 'Kabare', kind: 'town', pop: 50_000, radius_km: 6 },
  { name: 'Walungu', lat: -2.650, lon: 28.680, province: 'Sud-Kivu', territory: 'Walungu', kind: 'town', pop: 45_000, radius_km: 6 },
  { name: 'Idjwi', lat: -2.150, lon: 29.050, province: 'Sud-Kivu', territory: 'Idjwi', kind: 'territory', pop: 280_000, radius_km: 12, aliases: ['ile d idjwi', 'ile idjwi'] },
  { name: 'Kavumu', lat: -2.310, lon: 28.810, province: 'Sud-Kivu', territory: 'Kabare', kind: 'locality', pop: 30_000, radius_km: 3, aliases: ['aeroport de kavumu'] },

  /* ═══ ITURI ═══ */
  { name: 'Bunia', lat: 1.565, lon: 30.245, province: 'Ituri', territory: 'Irumu', kind: 'city', pop: 630_000, radius_km: 8, aliases: ['bunia ville'] },
  { name: 'Djugu', lat: 1.920, lon: 30.500, province: 'Ituri', territory: 'Djugu', kind: 'town', pop: 60_000, radius_km: 6, aliases: ['djugu centre', 'territoire de djugu'] },
  { name: 'Fataki', lat: 2.060, lon: 30.550, province: 'Ituri', territory: 'Djugu', kind: 'locality', pop: 25_000, radius_km: 4 },
  { name: 'Drodro', lat: 1.830, lon: 30.530, province: 'Ituri', territory: 'Djugu', kind: 'locality', pop: 30_000, radius_km: 4 },
  { name: 'Jiba', lat: 1.900, lon: 30.650, province: 'Ituri', territory: 'Djugu', kind: 'locality', pop: 15_000, radius_km: 3 },
  { name: 'Bule', lat: 2.100, lon: 30.600, province: 'Ituri', territory: 'Djugu', kind: 'locality', pop: 18_000, radius_km: 4 },
  { name: 'Linga', lat: 1.980, lon: 30.420, province: 'Ituri', territory: 'Djugu', kind: 'locality', pop: 12_000, radius_km: 3 },
  { name: 'Nizi', lat: 1.850, lon: 30.300, province: 'Ituri', territory: 'Djugu', kind: 'locality', pop: 20_000, radius_km: 4 },
  { name: 'Mongbwalu', lat: 1.930, lon: 30.040, province: 'Ituri', territory: 'Djugu', kind: 'town', pop: 60_000, radius_km: 4, aliases: ['mongbwalu mine'] },
  { name: 'Kilo', lat: 1.830, lon: 30.150, province: 'Ituri', territory: 'Djugu', kind: 'locality', pop: 15_000, radius_km: 3 },
  { name: 'Irumu', lat: 1.450, lon: 30.100, province: 'Ituri', territory: 'Irumu', kind: 'town', pop: 40_000, radius_km: 6, aliases: ['territoire d irumu'] },
  { name: 'Komanda', lat: 1.370, lon: 29.770, province: 'Ituri', territory: 'Irumu', kind: 'town', pop: 45_000, radius_km: 4 },
  { name: 'Nyakunde', lat: 1.420, lon: 30.080, province: 'Ituri', territory: 'Irumu', kind: 'locality', pop: 20_000, radius_km: 3 },
  { name: 'Bogoro', lat: 1.350, lon: 30.250, province: 'Ituri', territory: 'Irumu', kind: 'locality', pop: 14_000, radius_km: 3 },
  { name: 'Marabo', lat: 1.500, lon: 30.150, province: 'Ituri', territory: 'Irumu', kind: 'locality', pop: 12_000, radius_km: 3 },
  { name: 'Boga', lat: 1.130, lon: 30.060, province: 'Ituri', territory: 'Irumu', kind: 'locality', pop: 16_000, radius_km: 4 },
  { name: 'Tchabi', lat: 1.100, lon: 30.200, province: 'Ituri', territory: 'Irumu', kind: 'locality', pop: 13_000, radius_km: 4 },
  { name: 'Mambasa', lat: 1.360, lon: 29.050, province: 'Ituri', territory: 'Mambasa', kind: 'town', pop: 50_000, radius_km: 6 },
  { name: 'Mahagi', lat: 2.240, lon: 30.990, province: 'Ituri', territory: 'Mahagi', kind: 'town', pop: 70_000, radius_km: 6 },
  { name: 'Aru', lat: 2.870, lon: 30.830, province: 'Ituri', territory: 'Aru', kind: 'town', pop: 60_000, radius_km: 6 },
  { name: 'Ariwara', lat: 2.980, lon: 30.720, province: 'Ituri', territory: 'Aru', kind: 'town', pop: 50_000, radius_km: 4 },
  { name: 'Tchomia', lat: 1.480, lon: 30.530, province: 'Ituri', territory: 'Irumu', kind: 'locality', pop: 25_000, radius_km: 3 },
  { name: 'Kasenyi', lat: 1.400, lon: 30.450, province: 'Ituri', territory: 'Irumu', kind: 'locality', pop: 22_000, radius_km: 3 },

  /* ═══ TANGANYIKA / MANIEMA / HAUT-UELE ═══ */
  { name: 'Kalemie', lat: -5.950, lon: 29.190, province: 'Tanganyika', territory: 'Kalemie', kind: 'city', pop: 220_000, radius_km: 7 },
  { name: 'Nyunzu', lat: -5.940, lon: 28.010, province: 'Tanganyika', territory: 'Nyunzu', kind: 'town', pop: 40_000, radius_km: 6 },
  { name: 'Moba', lat: -7.050, lon: 29.780, province: 'Tanganyika', territory: 'Moba', kind: 'town', pop: 45_000, radius_km: 6 },
  { name: 'Manono', lat: -7.300, lon: 27.420, province: 'Tanganyika', territory: 'Manono', kind: 'town', pop: 60_000, radius_km: 6 },
  { name: 'Kindu', lat: -2.940, lon: 25.920, province: 'Maniema', territory: 'Kindu', kind: 'city', pop: 250_000, radius_km: 7 },
  { name: 'Kasongo', lat: -4.430, lon: 26.660, province: 'Maniema', territory: 'Kasongo', kind: 'town', pop: 60_000, radius_km: 6 },
  { name: 'Salamabila', lat: -4.060, lon: 27.100, province: 'Maniema', territory: 'Kabambare', kind: 'locality', pop: 25_000, radius_km: 4 },
  { name: 'Punia', lat: -1.370, lon: 26.340, province: 'Maniema', territory: 'Punia', kind: 'town', pop: 30_000, radius_km: 5 },
  { name: 'Bunyakiri-Hombo axis', lat: -1.985, lon: 28.475, province: 'Sud-Kivu', territory: 'Kalehe', kind: 'feature', radius_km: 12, aliases: ['axe hombo bunyakiri'] },
  { name: 'Dungu', lat: 3.620, lon: 28.570, province: 'Haut-Uele', territory: 'Dungu', kind: 'town', pop: 35_000, radius_km: 6 },
  { name: 'Faradje', lat: 3.740, lon: 29.710, province: 'Haut-Uele', territory: 'Faradje', kind: 'town', pop: 30_000, radius_km: 6 },
  { name: 'Isiro', lat: 2.770, lon: 27.620, province: 'Haut-Uele', territory: 'Rungu', kind: 'city', pop: 180_000, radius_km: 6 },

  /* ═══ NATIONAL REFERENCE ═══ */
  { name: 'Kinshasa', lat: -4.325, lon: 15.322, province: 'Kinshasa', kind: 'city', pop: 17_000_000, radius_km: 20 },
  { name: 'Lubumbashi', lat: -11.660, lon: 27.480, province: 'Haut-Katanga', kind: 'city', pop: 2_500_000, radius_km: 12 },
  { name: 'Kisangani', lat: 0.520, lon: 25.200, province: 'Tshopo', kind: 'city', pop: 1_200_000, radius_km: 10 },

  /* ═══ CROSS-BORDER (for flow / spillover analysis) ═══ */
  { name: 'Gisenyi', lat: -1.700, lon: 29.256, province: 'Rwanda — Rubavu', kind: 'border', pop: 130_000, radius_km: 5, aliases: ['rubavu'] },
  { name: 'Kigali', lat: -1.944, lon: 30.062, province: 'Rwanda — Kigali', kind: 'city', pop: 1_200_000, radius_km: 12 },
  { name: 'Cyangugu', lat: -2.485, lon: 28.900, province: 'Rwanda — Rusizi', kind: 'border', pop: 70_000, radius_km: 5, aliases: ['rusizi'] },
  { name: 'Bujumbura', lat: -3.383, lon: 29.365, province: 'Burundi — Bujumbura', kind: 'city', pop: 1_100_000, radius_km: 10 },
  { name: 'Kampala', lat: 0.347, lon: 32.582, province: 'Ouganda — Central', kind: 'city', pop: 1_700_000, radius_km: 15 },

  /* ═══ FEATURES / AXES ═══ */
  { name: 'Lac Kivu', lat: -2.000, lon: 29.000, province: 'Nord-Kivu', kind: 'feature', radius_km: 45, aliases: ['lake kivu', 'ziwa kivu'] },
  { name: 'Lac Édouard', lat: -0.400, lon: 29.600, province: 'Nord-Kivu', kind: 'feature', radius_km: 30, aliases: ['lac edouard', 'lake edward', 'rutanzige'] },
  { name: 'Lac Albert', lat: 1.700, lon: 30.900, province: 'Ituri', kind: 'feature', radius_km: 40, aliases: ['lake albert', 'mwitanzige'] },
  { name: 'Lac Tanganyika', lat: -6.000, lon: 29.500, province: 'Tanganyika', kind: 'feature', radius_km: 80, aliases: ['lake tanganyika'] },
  { name: 'Parc National des Virunga', lat: -0.900, lon: 29.400, province: 'Nord-Kivu', kind: 'feature', radius_km: 60, aliases: ['virunga', 'pnvi', 'parc des virunga'] },
  { name: 'Plaine de la Ruzizi', lat: -3.250, lon: 29.120, province: 'Sud-Kivu', territory: 'Uvira', kind: 'feature', radius_km: 25, aliases: ['plaine de ruzizi', 'ruzizi'] },
  { name: 'Hauts Plateaux', lat: -3.900, lon: 28.700, province: 'Sud-Kivu', territory: 'Fizi', kind: 'feature', radius_km: 40, aliases: ['hauts plateaux d uvira', 'moyens plateaux'] },
  { name: 'RN2', lat: -1.400, lon: 29.300, province: 'Nord-Kivu', kind: 'feature', radius_km: 30, aliases: ['route nationale 2', 'axe goma rutshuru'] },
  { name: 'RN4', lat: 0.600, lon: 29.550, province: 'Nord-Kivu', kind: 'feature', radius_km: 30, aliases: ['route nationale 4', 'axe beni kasindi'] },
  { name: 'RN5', lat: -2.950, lon: 29.000, province: 'Sud-Kivu', kind: 'feature', radius_km: 30, aliases: ['route nationale 5', 'axe bukavu uvira'] },
];

/* ── Province-level fallbacks ─────────────────────────────────────── */

export const PROVINCE_CENTROIDS: Record<string, { lat: number; lon: number; radius_km: number }> = {
  'Nord-Kivu':    { lat: -0.700, lon: 29.100, radius_km: 110 },
  'Sud-Kivu':     { lat: -3.000, lon: 28.300, radius_km: 120 },
  'Ituri':        { lat:  1.900, lon: 30.100, radius_km: 130 },
  'Tanganyika':   { lat: -6.400, lon: 28.500, radius_km: 180 },
  'Maniema':      { lat: -3.100, lon: 26.100, radius_km: 170 },
  'Haut-Uele':    { lat:  3.000, lon: 28.500, radius_km: 180 },
};

/* ── Index construction ──────────────────────────────────────────── */

/** Strips diacritics and punctuation, lowercases, collapses whitespace.
 *  "Nord-Kivu" and "nord kivu" and "NORD‑KIVU" all fold together. */
export function foldKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** name/alias → Place. Built once at module load. */
const INDEX = new Map<string, Place>();
/** First token → candidate places, for multi-word lookahead matching. */
const FIRST_TOKEN = new Map<string, Place[]>();

for (const p of PLACES) {
  const keys = [p.name, ...(p.aliases ?? [])].map(foldKey);
  for (const k of keys) {
    if (!INDEX.has(k)) INDEX.set(k, p);
    const head = k.split(' ')[0];
    const bucket = FIRST_TOKEN.get(head);
    if (bucket) { if (!bucket.includes(p)) bucket.push(p); }
    else FIRST_TOKEN.set(head, [p]);
  }
}

/** Longest alias length in tokens — bounds the lookahead window. */
export const MAX_PLACE_TOKENS = Math.max(
  ...[...INDEX.keys()].map((k) => k.split(' ').length),
);

export function lookupPlace(name: string): Place | undefined {
  return INDEX.get(foldKey(name));
}

export function placeCandidatesFor(token: string): Place[] {
  return FIRST_TOKEN.get(token) ?? [];
}

export function allPlaceKeys(): string[] {
  return [...INDEX.keys()];
}

/** Great-circle distance in km. */
export function haversineKm(
  aLat: number, aLon: number, bLat: number, bLon: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Nearest gazetteer settlement to a coordinate — used to give a place
 *  name to sensor hits (FIRMS pixels, acoustic bearings) that arrive with
 *  coordinates but no toponym. */
export function reverseGeocode(
  lat: number, lon: number, maxKm = 40,
): Place | undefined {
  let best: Place | undefined;
  let bestD = Infinity;
  for (const p of PLACES) {
    if (p.kind === 'feature' || p.kind === 'province') continue;
    const d = haversineKm(lat, lon, p.lat, p.lon);
    if (d < bestD) { bestD = d; best = p; }
  }
  return bestD <= maxKm ? best : undefined;
}
