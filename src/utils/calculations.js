import { clamp, P } from "./format";

const readInputs = (form) => {
  const nla = clamp(P(form.nla));
  const addon = clamp(P(form.addon));
  const gla = nla * (1 + addon / 100);
  const rent = clamp(P(form.rent));
  const duration = Math.max(0, Math.floor(P(form.duration)));
  const rf = clamp(P(form.rf));
  const agent = clamp(P(form.agent));
  const unforeseen = P(form.unforeseen);
  const perNLA = clamp(P(form.fitPerNLA));
  const perGLA = clamp(P(form.fitPerGLA));
  const tot = clamp(P(form.fitTot));

  return {
    nla,
    addon,
    gla,
    rent,
    duration,
    rf,
    agent,
    unforeseen,
    perNLA,
    perGLA,
    tot,
  };
};

export const calculateTotalFit = (form, values = readInputs(form)) => {
  if (form.fitMode === "perNLA") return values.perNLA * values.nla;
  if (form.fitMode === "perGLA") return values.perGLA * values.gla;
  return values.tot;
};

export const calculateNER = (form) => {
  const values = readInputs(form);
  const months = Math.max(0, values.duration - values.rf);
  const gross = values.rent * values.gla * months;
  const totalFit = calculateTotalFit(form, values);
  const agentFees = values.agent * values.rent * values.gla;
  const denom = Math.max(1e-9, values.duration * values.gla);

  const ner1 = gross / denom;
  const ner2 = (gross - totalFit) / denom;
  const ner3 = (gross - totalFit - agentFees) / denom;
  const ner4 = (gross - totalFit - agentFees + values.unforeseen) / denom;

  return {
    ...values,
    months,
    gross,
    totalFit,
    agentFees,
    denom,
    ner1,
    ner2,
    ner3,
    ner4,
    totalHeadline: values.rent * values.gla * values.duration,
    totalRentFrees: values.rent * values.gla * values.rf,
    totalAgentFees: agentFees,
    totalUnforeseen: values.unforeseen,
  };
};

export const calculateScenarioNER = (baseForm, overrides = {}) => {
  const form = { ...baseForm, ...overrides };
  const values = readInputs(form);
  const months = Math.max(0, values.duration - values.rf);
  const gross = values.rent * values.gla * months;
  const fitMode = baseForm.fitMode;

  let totalFit = 0;
  if (fitMode === "perNLA") totalFit = values.perNLA * values.nla;
  else if (fitMode === "perGLA") totalFit = values.perGLA * values.gla;
  else totalFit = values.tot;

  const agentFees = values.agent * values.rent * values.gla;
  const denom = Math.max(1e-9, values.duration * values.gla);

  return (gross - totalFit - agentFees + values.unforeseen) / denom;
};

export const getFitOutSyncUpdates = (form) => {
  const values = readInputs(form);
  const updates = {};

  if (form.fitMode === "perNLA") {
    const total = values.perNLA * values.nla;
    const perGLA = values.gla > 0 ? total / values.gla : 0;

    if (Math.abs(total - values.tot) > 1e-9) updates.fitTot = String(total);
    if (Math.abs(perGLA - values.perGLA) > 1e-9) updates.fitPerGLA = String(perGLA);
  } else if (form.fitMode === "perGLA") {
    const total = values.perGLA * values.gla;
    const perNLA = values.nla > 0 ? total / values.nla : 0;

    if (Math.abs(total - values.tot) > 1e-9) updates.fitTot = String(total);
    if (Math.abs(perNLA - values.perNLA) > 1e-9) updates.fitPerNLA = String(perNLA);
  } else {
    const perNLA = values.nla > 0 ? values.tot / values.nla : 0;
    const perGLA = values.gla > 0 ? values.tot / values.gla : 0;

    if (Math.abs(perNLA - values.perNLA) > 1e-9) updates.fitPerNLA = String(perNLA);
    if (Math.abs(perGLA - values.perGLA) > 1e-9) updates.fitPerGLA = String(perGLA);
  }

  return updates;
};
