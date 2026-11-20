/**
 * Every derived figure the statistics show has an entry here: raw figures
 * (distance, time, heart rate) need none, and a derived one without an entry
 * is not shown. Rejected figures have no entry at all.
 *
 * `reserved`: backed by the literature, within limits the user can read.
 * `estimate`: useful but without solid validation, always labelled as such.
 */
export type MetricVerdict = 'validated' | 'reserved' | 'estimate';

export interface MetricEntry {
  verdict: MetricVerdict;
  /** Plain arithmetic: reads the same in every language */
  formula: string;
  sources: { label: string; url: string }[];
}

const CLARKE_SKIBA = {
  label: 'Clarke & Skiba 2013',
  url: 'https://doi.org/10.1152/advan.00078.2011',
};
const SMYTH_MUNIZ_PUMARES = {
  label: 'Smyth & Muniz-Pumares 2020',
  url: 'https://doi.org/10.1249/MSS.0000000000002412',
};
const SANDFORD = {
  label: 'Sandford et al. 2021',
  url: 'https://doi.org/10.1007/s40279-021-01523-9',
};
const IMBACH = {
  label: 'Imbach et al. 2022',
  url: 'https://doi.org/10.1038/s41598-022-05392-8',
};

export const METRIC_REGISTRY = {
  sessionRpe: {
    verdict: 'validated',
    formula: 'RPE (0-10) × min',
    sources: [
      {
        label: 'Foster et al. 2001',
        url: 'https://doi.org/10.1519/00124278-200102000-00019',
      },
      {
        label: 'Haddad et al. 2017',
        url: 'https://doi.org/10.3389/fnins.2017.00612',
      },
    ],
  },
  trimp: {
    verdict: 'reserved',
    formula: 'min × ΔHR × 0.64 e^(1.92 ΔHR); ♀ 0.86 e^(1.67 ΔHR)',
    sources: [
      {
        label: 'Wallace et al. 2014',
        url: 'https://doi.org/10.1007/s00421-013-2745-1',
      },
    ],
  },
  ctl: {
    verdict: 'estimate',
    formula: 'CTL(d) = CTL(d-1) + (1 - e^(-1/42)) × (load - CTL(d-1))',
    sources: [CLARKE_SKIBA, IMBACH],
  },
  atl: {
    verdict: 'estimate',
    formula: 'ATL(d) = ATL(d-1) + (1 - e^(-1/7)) × (load - ATL(d-1))',
    sources: [CLARKE_SKIBA, IMBACH],
  },
  tsb: {
    verdict: 'estimate',
    formula: 'TSB = CTL - ATL',
    sources: [CLARKE_SKIBA, IMBACH],
  },
  intensityDistribution: {
    verdict: 'validated',
    formula: '5 zones: Z1-2 | Z3 | Z4-5',
    sources: [
      {
        label: 'Seiler & Kjerland 2006',
        url: 'https://doi.org/10.1111/j.1600-0838.2004.00418.x',
      },
      {
        label: 'Casado et al. 2022',
        url: 'https://doi.org/10.1123/ijspp.2021-0435',
      },
    ],
  },
  efficiency: {
    verdict: 'estimate',
    formula: 'output / HR',
    sources: [
      {
        label: 'Rothschild et al. 2025',
        url: 'https://doi.org/10.1007/s00421-025-05815-0',
      },
    ],
  },
  runEfficiency: {
    verdict: 'estimate',
    formula:
      'EF = GAP / HR; power / HR; RE = (m/s) / (W/kg) on the flat; (EF1 - EF2) / EF1',
    sources: [
      {
        label: 'Friel, Efficiency Factor and Decoupling',
        url: 'https://www.trainingpeaks.com/blog/efficiency-factor-and-decoupling/',
      },
      {
        label: 'Palladino, Running Effectiveness (Coggan, WKO)',
        url: 'https://www.trainingpeaks.com/blog/running-effectiveness-versus-speed-using-wko4/',
      },
      {
        label: 'Minetti et al. 2002',
        url: 'https://doi.org/10.1152/japplphysiol.01177.2001',
      },
    ],
  },
  decoupling: {
    verdict: 'estimate',
    formula: '(EF1 - EF2) / EF1',
    sources: [
      {
        label: 'Rothschild et al. 2025',
        url: 'https://doi.org/10.1007/s00421-025-05815-0',
      },
      {
        label: 'Coyle & González-Alonso 2001',
        url: 'https://doi.org/10.1097/00003677-200104000-00009',
      },
    ],
  },
  longRun: {
    verdict: 'reserved',
    formula: 'distance > 1.1 × longest (30 d)',
    sources: [
      {
        label: 'Frandsen et al. 2025',
        url: 'https://doi.org/10.1136/bjsports-2024-109380',
      },
    ],
  },
  criticalSpeed: {
    verdict: 'estimate',
    formula:
      'distance = D′ + CS × t (fastest grade adjusted 400 m, 800 m, 5 km)',
    sources: [
      SMYTH_MUNIZ_PUMARES,
      {
        label: 'Jones et al. 2010',
        url: 'https://doi.org/10.1249/MSS.0b013e3181d9cf7f',
      },
    ],
  },
  speedProfile: {
    verdict: 'estimate',
    formula: 'z = (D′ - 136 m) / 39 m; speed z > 1, endurance z < -1',
    sources: [SMYTH_MUNIZ_PUMARES, SANDFORD],
  },
  trainingFocus: {
    verdict: 'estimate',
    formula:
      'drift ≥ 5% → long runs; z > 1 → threshold; z < -1 → short intervals',
    sources: [
      {
        label: 'Jenkins & Quigley 1992',
        url: 'https://coachsci.sdsu.edu/csa/vol34/jenkins.htm',
      },
      {
        label: 'Jenkins & Quigley 1993',
        url: 'https://core.ac.uk/works/6329772',
      },
      {
        label: 'Thron et al. 2026',
        url: 'https://publikationen.bibliothek.kit.edu/1000190584',
      },
      SANDFORD,
      {
        label: 'Rothschild et al. 2025',
        url: 'https://doi.org/10.1007/s00421-025-05815-0',
      },
    ],
  },
  marathonStart: {
    verdict: 'estimate',
    formula: 'start ≤ 0.94 × CS',
    sources: [SMYTH_MUNIZ_PUMARES],
  },
  reserveBalance: {
    verdict: 'estimate',
    formula:
      'above CP: W′bal - (P - CP) × dt; below: W′bal + (CP - P) × (1 - W′bal / W′) × dt',
    sources: [
      {
        label: 'Skiba et al. 2015',
        url: 'https://doi.org/10.1007/s00421-014-3050-3',
      },
      {
        label: 'Vassallo et al. 2020',
        url: 'https://doi.org/10.1007/s00421-019-04266-8',
      },
      {
        label: 'Bellenger et al. 2025',
        url: 'https://doi.org/10.1123/ijspp.2024-0036',
      },
    ],
  },
  cardiacCost: {
    verdict: 'estimate',
    formula: 'median HR by band of grade adjusted speed or power',
    sources: [
      {
        label: 'Vesterinen et al. 2014',
        url: 'https://doi.org/10.1519/JSC.0000000000000349',
      },
    ],
  },
  drift: {
    verdict: 'estimate',
    formula: '(last third - first third) / first third, 60 min or more',
    sources: [
      {
        label: 'Smyth et al. 2022',
        url: 'https://doi.org/10.1007/s40279-022-01680-5',
      },
      {
        label: 'Coyle & González-Alonso 2001',
        url: 'https://doi.org/10.1097/00003677-200104000-00009',
      },
    ],
  },
  recordCoherence: {
    verdict: 'estimate',
    formula: 'T2 = T1 × (D2 / D1)^k, k 1.04-1.08 (to 1.15 for the marathon)',
    sources: [
      {
        label: 'Vickers & Vertosick 2016',
        url: 'https://doi.org/10.1186/s13102-016-0052-y',
      },
    ],
  },
  racePrediction: {
    verdict: 'estimate',
    formula: 'T2 = T1 × (D2 / D1)^k, k 1.04-1.08; marathon k 1.07-1.15',
    sources: [
      {
        label: 'Vickers & Vertosick 2016',
        url: 'https://doi.org/10.1186/s13102-016-0052-y',
      },
    ],
  },
  hrvTrend: {
    verdict: 'reserved',
    formula: 'mean(ln rMSSD, 7 days)',
    sources: [
      {
        label: 'Plews et al. 2013',
        url: 'https://doi.org/10.1007/s40279-013-0071-8',
      },
      {
        label: 'Buchheit 2014',
        url: 'https://doi.org/10.3389/fphys.2014.00073',
      },
    ],
  },
  criticalSwimSpeed: {
    verdict: 'reserved',
    formula: 'CSS = (400 - 200) / (T400 - T200)',
    sources: [
      {
        label: 'Wakayoshi et al. 1992',
        url: 'https://doi.org/10.1007/bf00717953',
      },
      {
        label: 'Dekerle et al. 2005',
        url: 'https://doi.org/10.1055/s-2004-821227',
      },
    ],
  },
  criticalPower: {
    verdict: 'reserved',
    formula: 'work = W′ + CP × t (2-20 min)',
    sources: [
      {
        label: 'Jones et al. 2010',
        url: 'https://doi.org/10.1249/MSS.0b013e3181d9cf7f',
      },
      {
        label: 'Karsten et al. 2014',
        url: 'https://doi.org/10.1007/s00421-014-3001-z',
      },
    ],
  },
  monotony: {
    verdict: 'estimate',
    formula: 'mean(daily load, 7 d) / SD(daily load, 7 d)',
    sources: [
      {
        label: 'Foster 1998',
        url: 'https://doi.org/10.1097/00005768-199807000-00023',
      },
    ],
  },
  gap: {
    verdict: 'reserved',
    formula:
      'v × Cr(i) / Cr(0); Cr = 155.4i⁵ - 30.4i⁴ - 43.3i³ + 46.3i² + 19.5i + 3.6',
    sources: [
      {
        label: 'Minetti et al. 2002',
        url: 'https://doi.org/10.1152/japplphysiol.01177.2001',
      },
    ],
  },
} as const satisfies Record<string, MetricEntry>;

export type MetricKey = keyof typeof METRIC_REGISTRY;
