import { LEVEL_LABELS, PARAMETER_LABELS } from "../uiText.js";

const ORDER = ["aggression", "openness", "creativity", "confidence", "cooperation"];

export default function ParamChips({ params }) {
  if (!params) return null;
  return (
    <>
      {ORDER.map((k) => {
        const lvl = params[k].level;
        const cls = "lv-" + lvl.replace(/\s+/g, "-");
        return (
          <div className={"chip " + cls} key={k}>
            <span className="lbl">{PARAMETER_LABELS[k]}</span>
            <span className="val">{LEVEL_LABELS[lvl] || lvl}</span>
          </div>
        );
      })}
    </>
  );
}
