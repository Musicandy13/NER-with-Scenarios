# Net Effective Rent (NER) Calculator

A browser-based calculator for evaluating office lease economics through Net Effective Rent (NER). The app compares headline rent against rent-free periods, fit-out contributions, agent fees, lump-sum costs, compensation, and editable scenarios.

> NER in this project means **Net Effective Rent**, not Named Entity Recognition.

## Screenshot

The current UI shows input fields on the left, live NER results and charts on the right, and a scenario comparison table below. To keep the screenshot current, run the app locally and use **Export Full PNG** from the app, then save the exported image as `docs/screenshot.png`.

```md
![Net Effective Rent Calculator](docs/screenshot.png)
```

## Features

- Calculates headline rent and Net Effective Rent steps from lease assumptions.
- Supports NLA, add-on percentage, GLA, rent-free months, fit-out values, agent fees, and lump-sum costs or compensation.
- Keeps fit-out input synchronized between EUR/NLA, EUR/GLA, and total EUR modes.
- Includes three editable scenarios next to the current case.
- Visualizes NER changes with bar and waterfall charts.
- Exports result or full calculator views as PNG.
- Exports a project HTML file that reopens the calculator with saved data.
- Includes a simple Apple support route at `/apple-support`.

## Local Installation

```bash
npm install
npm run dev
```

Vite prints a local development URL, usually `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview
```

`npm run build` creates the production bundle in `dist/`. `npm run preview` serves the built app locally for a final smoke test before deployment.

## Calculation Logic

The app currently calculates with these core values:

- `GLA = NLA * (1 + add-on / 100)`
- `chargeableMonths = leaseTermMonths - rentFreeMonths`
- `grossRent = headlineRentPerSqm * GLA * chargeableMonths`
- `denominator = leaseTermMonths * GLA`

NER steps:

1. **NER 1 incl. Rent Frees**  
   `NER1 = grossRent / denominator`
2. **NER 2 incl. Fit-Outs**  
   `NER2 = (grossRent - totalFitOut) / denominator`
3. **NER 3 incl. Agent Fees**  
   `NER3 = (grossRent - totalFitOut - agentFees) / denominator`
4. **Final NER incl. Lumpsum Costs / Compensation**  
   `NER4 = (grossRent - totalFitOut - agentFees + lumpsumOrCompensation) / denominator`

Fit-out handling depends on the selected mode:

- `EUR/NLA`: `totalFitOut = fitOutPerNLA * NLA`
- `EUR/GLA`: `totalFitOut = fitOutPerGLA * GLA`
- `Total`: `totalFitOut = fitOutTotal`

Agent fees are calculated as:

```txt
agentFees = agentFeeMonths * headlineRentPerSqm * GLA
```

Scenario calculations reuse the same final NER logic with per-scenario overrides.

## Project Structure

Current implementation is concentrated in `src/App.jsx`. A useful next refactor would be:

```txt
src/
  components/
    Charts.jsx
    NumericField.jsx
    ScenarioTable.jsx
  pages/
    Support.jsx
  utils/
    calculations.js
    format.js
```

That would make the NER formulas easier to test independently from React rendering.

## Recommended Next Improvements

- Add `package-lock.json` by running `npm install` and committing the generated lockfile.
- Move calculation helpers into `src/utils/calculations.js`.
- Add Vitest coverage for parsing, fit-out synchronization, and NER 1-4.
- Add a GitHub Actions workflow that runs `npm install` and `npm run build` on every push or pull request.
- Verify that all PWA assets referenced in `vite.config.js` exist in `public/`.
- Consolidate support content so `/apple-support` and `public/apple-support.html` do not diverge.

## Support

For support, questions, bug reports, or feature requests, contact:

[andriy.ivchenko@gmx.at](mailto:andriy.ivchenko@gmx.at)

The support page says responses usually arrive within 2 business days.

## Privacy

This app is a client-side calculator. Project export stores the entered assumptions inside a generated local HTML file or URL data payload. Do not share exported project files or URLs if they contain confidential tenant or lease data.

## License

No license file is currently included. Add one before publishing or inviting external reuse.