import { JOB_MARKET_FACTS } from "../constants/job-market-facts";

const index = Math.floor(Math.random() * JOB_MARKET_FACTS.length);

export const sessionJobMarketFact = JOB_MARKET_FACTS[index];
