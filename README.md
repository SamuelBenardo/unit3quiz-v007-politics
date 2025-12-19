# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Unit 3 Quiz Notes

- **Data source (required citation):** `https://catalog.data.gov/dataset/warehouse-and-retail-sales`
- This app fetches a **monthly aggregated** view via the Socrata API so the browser doesn’t download ~300k raw rows.

### Optional env vars (Vite)

Create a `.env.local` (not committed) with:

- **GitHub link in footer**
  - `VITE_GITHUB_URL=https://github.com/<you>/<your-repo>`
- **Firebase Auth (email/password) via REST**
  - `VITE_FIREBASE_WEB_API_KEY=...`
  - In Firebase Console → Authentication → Sign-in method → enable **Email/Password**
- **Firestore vote logging (optional)**
  - `VITE_FIREBASE_PROJECT_ID=...`
  - Enable Firestore in Firebase Console and set rules appropriately
