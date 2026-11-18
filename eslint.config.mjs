// Next 16 dropped `next lint`; same rules as the old .eslintrc ("next/core-web-vitals"), flat config.
import coreWebVitals from "eslint-config-next/core-web-vitals";

const config = [...coreWebVitals, { ignores: [".next/**", "node_modules/**"] }];

export default config;
