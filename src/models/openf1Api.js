const BASE_URL = "https://api.openf1.org/v1";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const createOpenF1Client = ({
  rateLimitMs = 500,
  timeoutMs = 10000,
  retries = 3,
  initialDelayMs = 600,
} = {}) => {
  let lastRequestAt = 0;

  const rateLimit = async () => {
    const now = Date.now();
    const wait = Math.max(0, rateLimitMs - (now - lastRequestAt));
    if (wait > 0) {
      await sleep(wait);
    }
    lastRequestAt = Date.now();
  };

  const fetchJson = async (url) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  };

  const fetchJsonWithRetry = async (url) => {
    let delayMs = initialDelayMs;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        await rateLimit();
        return await fetchJson(url);
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
      }
      await sleep(delayMs);
      delayMs *= 2;
    }
    return [];
  };

  const getSessionsByQuery = async ({ countryName, sessionName, year }) => {
    const url = `${BASE_URL}/sessions?country_name=${encodeURIComponent(
      countryName,
    )}&session_name=${encodeURIComponent(
      sessionName,
    )}&year=${encodeURIComponent(year)}`;
    return fetchJsonWithRetry(url);
  };

  const getSessionByKey = async (sessionKey) => {
    const url = `${BASE_URL}/sessions?session_key=${encodeURIComponent(
      sessionKey,
    )}`;
    return fetchJsonWithRetry(url);
  };

  const getDrivers = async (sessionKey) => {
    const url = `${BASE_URL}/drivers?session_key=${encodeURIComponent(
      sessionKey,
    )}`;
    return fetchJsonWithRetry(url);
  };

  const getSessionResult = async (sessionKey) => {
    const url = `${BASE_URL}/session_result?session_key=${encodeURIComponent(
      sessionKey,
    )}`;
    return fetchJsonWithRetry(url);
  };

  const getRaceControl = async (sessionKey) => {
    const url = `${BASE_URL}/race_control?session_key=${encodeURIComponent(
      sessionKey,
    )}`;
    return fetchJsonWithRetry(url);
  };

  const getLapsForDriver = async (
    sessionKey,
    driverNumber,
    startLapNumber = 1,
    endLapNumber = 2,
  ) => {
    const params = new URLSearchParams({
      session_key: sessionKey,
      driver_number: driverNumber,
    });
    const base = params.toString();
    const url = `${BASE_URL}/laps?${base}&lap_number>=${startLapNumber}&lap_number<=${endLapNumber}`;
    return fetchJsonWithRetry(url);
  };


  return {
    getSessionsByQuery,
    getSessionByKey,
    getDrivers,
    getSessionResult,
    getRaceControl,
    getLapsForDriver,
  };
};
