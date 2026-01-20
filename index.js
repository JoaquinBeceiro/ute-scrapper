// ute-cmgraficar.js
import "dotenv/config";
import { chromium } from "playwright";
import asciichart from "asciichart";

const USER = process.env.UTE_USER;
const PASS = process.env.UTE_PASS;
const SA_ID = process.env.UTE_SA_ID;
const PS_ID = process.env.UTE_PS_ID;

if (!USER || !PASS || !SA_ID || !PS_ID) {
    console.error(
        "Faltan variables de entorno. Requeridas: UTE_USER, UTE_PASS, UTE_SA_ID, UTE_PS_ID"
    );
    process.exit(1);
}

const fechaInicial = "29-12-2025";
const fechaFinal = "18-01-2026";

function parseLabelToDate(label, fechaInicial, fechaFinal) {

    const [, dayMonth] = label.split(" ");
    const [day, month] = dayMonth.split("/").map(Number);

    const [, , startYear] = fechaInicial.split("-").map(Number);
    const startMonth = Number(fechaInicial.split("-")[1]);
    const endYear = Number(fechaFinal.split("-")[2]);

    const year = month >= startMonth ? startYear : endYear;

    return new Date(year, month - 1, day);
}


const cmVisualizarUrl =
    `https://autoservicio.ute.com.uy/SelfService/SSvcController/cmvisualizarcurvadecarga` +
    `?saId=${encodeURIComponent(SA_ID)}` +
    `&spId=${encodeURIComponent(PS_ID)}`;

const cmGraficarUrl =
    "https://autoservicio.ute.com.uy/SelfService/SSvcController/cmgraficar" +
    `?graficas%5B0%5D%5Bname%5D=CURVA_DE_CONSUMO` +
    `&graficas%5B0%5D%5Bparms%5D%5BpsId%5D=${encodeURIComponent(PS_ID)}` +
    `&graficas%5B0%5D%5Bparms%5D%5BmeterId%5D=` +
    `&graficas%5B0%5D%5Bparms%5D%5BfechaInicial%5D=${encodeURIComponent(fechaInicial)}` +
    `&graficas%5B0%5D%5Bparms%5D%5BfechaFinal%5D=${encodeURIComponent(fechaFinal)}` +
    `&graficas%5B0%5D%5Bparms%5D%5Bagrupacion%5D=D` +
    `&graficas%5B0%5D%5Bparms%5D%5Bmagnitudes%5D=IMPORT_ACTIVE_ENERGY%2CQ1_REACTIVE_ENERGY`;

(async () => {
    const browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({
        userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    console.log("Abriendo autoservicio...");
    await page.goto("https://autoservicio.ute.com.uy/SelfService/", {
        waitUntil: "domcontentloaded",
    });

    console.log("Logueando...");
    await page.fill('input[name="userId"]', USER);
    await page.fill('input[name="password"]', PASS);
    await page.click('button[type="submit"]');

    await page.waitForLoadState("networkidle");

    const cookies = await context.cookies();
    const hasSession = cookies.some((c) => c.name === "SSVCJSESSIONID");
    console.log("Sesion SSVCJSESSIONID:", hasSession ? "OK" : "NO ENCONTRADA");

    console.log("Abriendo pantalla de curva de carga (contexto)...");
    await page.goto(cmVisualizarUrl, { waitUntil: "networkidle" });

    console.log("Pidiendo cmgraficar (fetch dentro de la página)...");
    const { status, text } = await page.evaluate(async (url) => {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "*/*",
                "X-Requested-With": "XMLHttpRequest",
            },
            credentials: "include",
        });

        return {
            status: res.status,
            text: await res.text(),
        };
    }, cmGraficarUrl);

    console.log("HTTP status:", status);

    const trimmed = text.trim();
    if (!trimmed.startsWith("{")) {
        console.error("Respuesta no JSON (primeros 500 chars):");
        console.error(trimmed.slice(0, 500));
        await browser.close();
        process.exit(1);
    }

    const response = JSON.parse(trimmed);

    const datasetEnergiaActiva = response?.CURVA_DE_CONSUMO?.data?.datasets?.find(
        (d) => d.label === "Energia Activa Entrante kWh"
    );

    if (!datasetEnergiaActiva?.data) {
        const labelsDisponibles =
            response?.CURVA_DE_CONSUMO?.data?.datasets?.map((d) => d.label) ?? [];
        console.error("No encontré 'Energia Activa Entrante kWh'. Labels:");
        console.error(labelsDisponibles);
        await browser.close();
        process.exit(1);
    }

    const energiaActiva = datasetEnergiaActiva.data.map((n) => Number(n || 0));
    const total = energiaActiva.reduce((acc, curr) => acc + curr, 0);

    console.log("Total de energia activa (kWh):", total.toFixed(2));

    const labels = response.CURVA_DE_CONSUMO.data.labels;

    const consumoPorDia = labels.map((label, i) => ({
        label,
        kwh: energiaActiva[i] ?? null,
    }));

    const consumoConFecha = consumoPorDia.map(item => {
        const date = parseLabelToDate(item.label, fechaInicial, fechaFinal);

        return {
            date,
            iso: date.toISOString().slice(0, 10),
            kwh: item.kwh
        };
    });

    // console.log(JSON.stringify(consumoConFecha, null, 2));

    const series = consumoConFecha.map(d => d.kwh);

    console.log(
        asciichart.plot(series, {
            height: 15,
            format: v => `${v.toFixed(1)} kWh`
        })
    );


    await browser.close();
})();
