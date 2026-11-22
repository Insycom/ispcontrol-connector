import { RouterOsClient, type RouterCredentials } from "../routeros-client.js";

const path = "/tool/graphing/queue";
type GraphRouter = Pick<RouterOsClient, "print" | "add" | "set">;

export async function reconcileQueueGraphs(
  router: GraphRouter,
  serverId: string,
  enabled: boolean,
) {
  const identity = { comment: "ISPControl queue graphs " + serverId };
  const config = {
    "simple-queue": "all",
    "allow-address": "127.0.0.1/32",
    "allow-target": "no",
    "store-on-disk": "yes",
    disabled: enabled ? "no" : "yes",
  };
  const read = () =>
    router.print(
      path,
      identity,
      ".id,disabled,simple-queue,allow-address,allow-target,store-on-disk",
    );
  const rows = await read();
  if (rows.length > 1)
    throw new Error(
      "Hay varias reglas de gráficos de ISP Control para este servidor.",
    );
  if (!rows.length && !enabled) return;
  if (!rows.length) await router.add(path, { ...identity, ...config });
  else {
    const id = rows[0]?.[".id"];
    if (!id) throw new Error("Falta el identificador de la regla de gráficos.");
    await router.set(path, id, config);
  }
  const [saved] = await read();
  if (
    !saved ||
    (enabled
      ? !["false", "no"].includes(saved.disabled ?? "")
      : !["true", "yes"].includes(saved.disabled ?? ""))
  )
    throw new Error("MikroTik no confirmó el estado de la regla de gráficos.");
}

export async function syncQueueGraphs(
  credentials: RouterCredentials,
  serverId: string,
  enabled: boolean,
) {
  const router = new RouterOsClient(credentials);
  try {
    await router.connect();
    await reconcileQueueGraphs(router, serverId, enabled);
    return { queueGraphsEnabled: enabled };
  } finally {
    await router.close();
  }
}
