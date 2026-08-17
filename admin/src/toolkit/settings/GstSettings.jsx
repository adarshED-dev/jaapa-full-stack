import React from "react";
import { Percent, Plus, Trash2 } from "lucide-react";
import {
  Card,
  Field,
  FieldBlock,
  TextInput,
  SelectField,
  Switch,
  SettingsPanel,
  Banner,
} from "./FormControls";
import { useSettingsSection, isGstin, INDIAN_STATES, GST_RATES } from "./settingsApi";

const DEFAULTS = {
  gstin: "",
  registrationType: "regular",
  placeOfSupply: "",
  pricesIncludeTax: true,
  taxOnShipping: true,
  defaultRate: 18,
  stateRates: [], // [{ state, rate }]
};

const REGISTRATION_TYPES = [
  { value: "regular", label: "Regular (GSTIN registered)" },
  { value: "composition", label: "Composition scheme" },
  { value: "unregistered", label: "Not registered" },
];

const rateOptions = GST_RATES.map((rate) => ({ value: String(rate), label: `${rate}%` }));

function validateGstin(form) {
  if (form.registrationType === "unregistered") return "";
  if (!form.gstin.trim()) return "GSTIN is required for a registered business.";
  return isGstin(form.gstin) ? "" : "Enter a valid 15-character GSTIN, e.g. 23AAAAA0000A1Z5.";
}

function validate(form) {
  const errors = {
    gstin: validateGstin(form),
    placeOfSupply: form.placeOfSupply ? "" : "Select your home state — it decides CGST/SGST vs IGST.",
  };

  const incomplete = form.stateRates.some((row) => !row.state);
  const duplicates =
    new Set(form.stateRates.map((row) => row.state)).size !== form.stateRates.length;
  errors.stateRates = incomplete
    ? "Every row needs a state."
    : duplicates
      ? "A state can only appear once."
      : "";

  return errors;
}

// The first two digits of a GSTIN are the state code, so a GSTIN that
// disagrees with the selected home state is almost always a typo.
function gstinStateMismatch(form) {
  if (!isGstin(form.gstin) || !form.placeOfSupply) return null;
  const code = form.gstin.trim().slice(0, 2);
  const state = INDIAN_STATES.find((s) => s.code === code);
  if (!state || state.name === form.placeOfSupply) return null;
  return state.name;
}

function StateRateRow({ row, index, usedStates, onChange, onRemove }) {
  const half = (Number(row.rate) / 2).toFixed(2).replace(/\.00$/, "");
  const available = INDIAN_STATES.filter(
    (s) => s.name === row.state || !usedStates.includes(s.name)
  ).map((s) => s.name);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3 sm:flex-row sm:items-center">
      <div className="flex-1">
        <SelectField
          placeholder="Select state"
          value={row.state}
          onChange={(e) => onChange(index, { ...row, state: e.target.value })}
          options={available}
        />
      </div>
      <div className="w-full sm:w-40">
        <SelectField
          value={String(row.rate)}
          onChange={(e) => onChange(index, { ...row, rate: Number(e.target.value) })}
          options={rateOptions}
        />
      </div>
      <p className="w-full text-xs text-gray-400 sm:w-44">
        CGST {half}% + SGST {half}%
      </p>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Remove
      </button>
    </div>
  );
}

export default function GstSettings() {
  const state = useSettingsSection("gst-settings", DEFAULTS, validate);
  const { form, update, errors } = state;

  const usedStates = form.stateRates.map((row) => row.state).filter(Boolean);
  const mismatch = gstinStateMismatch(form);
  const unregistered = form.registrationType === "unregistered";

  function updateRow(index, next) {
    update(
      "stateRates",
      form.stateRates.map((row, i) => (i === index ? next : row))
    );
  }

  function addRow() {
    update("stateRates", [...form.stateRates, { state: "", rate: form.defaultRate }]);
  }

  function removeRow(index) {
    update("stateRates", form.stateRates.filter((_, i) => i !== index));
  }

  return (
    <SettingsPanel
      icon={Percent}
      title="GST Settings"
      description="Your GST registration, default tax rate and state-wise overrides."
      state={state}
    >
      <Card title="Registration" description="Printed on every tax invoice you issue.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Registration type">
            <SelectField
              value={form.registrationType}
              onChange={(e) => update("registrationType", e.target.value)}
              options={REGISTRATION_TYPES}
            />
          </Field>
          <Field
            label="GSTIN"
            error={errors.gstin}
            hint={unregistered ? "Not needed while unregistered." : "15 characters, e.g. 23AAAAA0000A1Z5."}
          >
            <TextInput
              placeholder="23AAAAA0000A1Z5"
              maxLength={15}
              disabled={unregistered}
              value={form.gstin}
              error={errors.gstin}
              onChange={(e) => update("gstin", e.target.value.toUpperCase().replace(/\s/g, ""))}
            />
          </Field>
          <Field
            label="Place of supply (home state)"
            error={errors.placeOfSupply}
            hint="Orders inside this state are taxed as CGST + SGST; everywhere else is IGST."
          >
            <SelectField
              placeholder="Select state"
              value={form.placeOfSupply}
              error={errors.placeOfSupply}
              onChange={(e) => update("placeOfSupply", e.target.value)}
              options={INDIAN_STATES.map((s) => s.name)}
            />
          </Field>
        </div>

        {mismatch && (
          <div className="mt-4">
            <Banner tone="info">
              This GSTIN is registered in <strong>{mismatch}</strong>, but the place of supply is set
              to <strong>{form.placeOfSupply}</strong>. Double-check which one is right.
            </Banner>
          </div>
        )}
      </Card>

      <Card title="Tax behaviour" description="How tax is applied to prices at checkout.">
        <div className="flex flex-col gap-4">
          <Field label="Default GST rate" hint="Applied to every product that has no state override below.">
            <SelectField
              value={String(form.defaultRate)}
              onChange={(e) => update("defaultRate", Number(e.target.value))}
              options={rateOptions}
            />
          </Field>
          <div className="flex flex-col gap-4 border-t border-gray-50 pt-4">
            <Switch
              checked={form.pricesIncludeTax}
              onChange={(v) => update("pricesIncludeTax", v)}
              label="Product prices already include GST"
              description="On — the listed price is final and tax is worked backwards out of it. Off — GST is added at checkout."
            />
            <Switch
              checked={form.taxOnShipping}
              onChange={(v) => update("taxOnShipping", v)}
              label="Charge GST on shipping charges"
              description="Shipping is taxed at the same rate as the order."
            />
          </div>
        </div>
      </Card>

      <Card
        title="State-wise GST rates"
        description="Optional overrides. Any state not listed here uses the default rate above."
      >
        <FieldBlock error={errors.stateRates}>
          <div className="flex flex-col gap-3">
            {form.stateRates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center">
                <p className="text-sm text-gray-500">
                  No state overrides yet — every order is taxed at {form.defaultRate}%.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden gap-3 px-3 text-xs font-medium text-gray-400 sm:flex">
                  <span className="flex-1">State</span>
                  <span className="w-40">GST rate</span>
                  <span className="w-44">Intra-state split</span>
                  <span className="w-[86px]" />
                </div>
                {form.stateRates.map((row, index) => (
                  <StateRateRow
                    key={index}
                    row={row}
                    index={index}
                    usedStates={usedStates}
                    onChange={updateRow}
                    onRemove={removeRow}
                  />
                ))}
              </>
            )}

            <button
              type="button"
              onClick={addRow}
              disabled={form.stateRates.length >= INDIAN_STATES.length}
              className="flex w-fit items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
            >
              <Plus className="h-4 w-4" />
              Add state rate
            </button>
          </div>
        </FieldBlock>
      </Card>
    </SettingsPanel>
  );
}
