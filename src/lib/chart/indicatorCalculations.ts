/**
 * Calculation formulas adapted from KLineChart v10.1.0.
 * Copyright (c) 2019 lihu.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * Modifications: retain calculations/figures only, add application types;
 * rendering and renderer-specific styling are intentionally omitted.
 */
import type { ChartCandle } from './model';

export type IndicatorValues = Record<string, number>;
export interface IndicatorCandle extends ChartCandle { turnover?: number; }
export interface IndicatorFigure { key: string; title: string; type: 'line' | 'bar' | 'circle'; baseValue?: number; }
export interface IndicatorCalculation { calcParams: number[]; figures: IndicatorFigure[]; }
export interface IndicatorDefinition {
 name: string; calcParams?: number[]; figures: IndicatorFigure[];
 regenerateFigures?: (params: number[]) => IndicatorFigure[];
 calc: (dataList: readonly IndicatorCandle[], indicator: IndicatorCalculation) => IndicatorValues[];
 minValue?: number; maxValue?: number; precision?: number; series?: string;
}
function getMaxMin(dataList: readonly IndicatorCandle[], maxKey: 'high', minKey: 'low'): [number,number] {
 return [Math.max(...dataList.map(data=>data[maxKey])),Math.min(...dataList.map(data=>data[minKey]))];
}
function getBollMd(dataList: readonly IndicatorCandle[], ma: number): number {
 const variance=dataList.reduce((sum,data)=>sum+(data.close-ma)**2,0)/dataList.length;
 return Math.sqrt(Math.abs(variance));
}
function getVolumeFigure(): IndicatorFigure { return { key: 'volume', title: 'VOLUME: ', type: 'bar', baseValue:0 }; }

const averagePrice: IndicatorDefinition = {
    name: 'AVP',
    series: 'price',
    precision: 2,
    figures: [{ key: 'avp', title: 'AVP: ', type: 'line' }],
    calc: function (dataList) {
        let totalTurnover = 0;
        let totalVolume = 0;
        return dataList.map(function (kLineData) {
            let _a, _b;
            const avp: IndicatorValues = {};
            const turnover = (_a = kLineData.turnover) !== null && _a !== void 0 ? _a : 0;
            const volume = (_b = kLineData.volume) !== null && _b !== void 0 ? _b : 0;
            totalTurnover += turnover;
            totalVolume += volume;
            if (totalVolume !== 0) {
                avp.avp = totalTurnover / totalVolume;
            }
            return avp;
        });
    }
};

const awesomeOscillator: IndicatorDefinition = {
    name: 'AO',
    calcParams: [5, 34],
    figures: [
        {
            key: 'ao',
            title: 'AO: ',
            type: 'bar',
            baseValue: 0
        }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        const maxPeriod = Math.max(params[0], params[1]);
        let shortSum = 0;
        let longSum = 0;
        let short = 0;
        let long = 0;
        return dataList.map(function (kLineData, i) {
            const ao: IndicatorValues = {};
            const middle = (kLineData.low + kLineData.high) / 2;
            shortSum += middle;
            longSum += middle;
            if (i >= params[0] - 1) {
                short = shortSum / params[0];
                const agoKLineData = dataList[i - (params[0] - 1)];
                shortSum -= (agoKLineData.low + agoKLineData.high) / 2;
            }
            if (i >= params[1] - 1) {
                long = longSum / params[1];
                const agoKLineData = dataList[i - (params[1] - 1)];
                longSum -= (agoKLineData.low + agoKLineData.high) / 2;
            }
            if (i >= maxPeriod - 1) {
                ao.ao = short - long;
            }
            return ao;
        });
    }
};

const bias: IndicatorDefinition = {
    name: 'BIAS',
    calcParams: [6, 12, 24],
    figures: [
        { key: 'bias1', title: 'BIAS6: ', type: 'line' },
        { key: 'bias2', title: 'BIAS12: ', type: 'line' },
        { key: 'bias3', title: 'BIAS24: ', type: 'line' }
    ],
    regenerateFigures: function (params) { return params.map(function (p, i) { return ({ key: "bias".concat(String(i + 1)), title: "BIAS".concat(String(p), ": "), type: 'line' }); }); },
    calc: function (dataList, indicator) {
        const params = indicator.calcParams, figures = indicator.figures;
        const closeSums: number[] = [];
        return dataList.map(function (kLineData, i) {
            const bias: IndicatorValues = {};
            const close = kLineData.close;
            params.forEach(function (p, index) {
                let _a;
                closeSums[index] = ((_a = closeSums[index]) !== null && _a !== void 0 ? _a : 0) + close;
                if (i >= p - 1) {
                    const mean = closeSums[index] / params[index];
                    bias[figures[index].key] = ((close - mean) / mean) * 100;
                    closeSums[index] -= dataList[i - (p - 1)].close;
                }
            });
            return bias;
        });
    }
};

const bollingerBands: IndicatorDefinition = {
    name: 'BOLL',
    series: 'price',
    calcParams: [20, 2],
    precision: 2,
    figures: [
        { key: 'up', title: 'UP: ', type: 'line' },
        { key: 'mid', title: 'MID: ', type: 'line' },
        { key: 'dn', title: 'DN: ', type: 'line' }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        const p = params[0] - 1;
        let closeSum = 0;
        return dataList.map(function (kLineData, i) {
            const close = kLineData.close;
            const boll: IndicatorValues = {};
            closeSum += close;
            if (i >= p) {
                boll.mid = closeSum / params[0];
                const md = getBollMd(dataList.slice(i - p, i + 1), boll.mid);
                boll.up = boll.mid + params[1] * md;
                boll.dn = boll.mid - params[1] * md;
                closeSum -= dataList[i - p].close;
            }
            return boll;
        });
    }
};

const brar: IndicatorDefinition = {
    name: 'BRAR',
    calcParams: [26],
    figures: [
        { key: 'br', title: 'BR: ', type: 'line' },
        { key: 'ar', title: 'AR: ', type: 'line' }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        let hcy = 0;
        let cyl = 0;
        let ho = 0;
        let ol = 0;
        return dataList.map(function (kLineData, i) {
            let _a, _b;
            const brar: IndicatorValues = {};
            const high = kLineData.high;
            const low = kLineData.low;
            const open = kLineData.open;
            const prevClose = ((_a = dataList[i - 1]) !== null && _a !== void 0 ? _a : kLineData).close;
            ho += high - open;
            ol += open - low;
            hcy += high - prevClose;
            cyl += prevClose - low;
            if (i >= params[0] - 1) {
                if (ol !== 0) {
                    brar.ar = (ho / ol) * 100;
                }
                else {
                    brar.ar = 0;
                }
                if (cyl !== 0) {
                    brar.br = (hcy / cyl) * 100;
                }
                else {
                    brar.br = 0;
                }
                const agoKLineData = dataList[i - (params[0] - 1)];
                const agoHigh = agoKLineData.high;
                const agoLow = agoKLineData.low;
                const agoOpen = agoKLineData.open;
                const agoPreClose = ((_b = dataList[i - params[0]]) !== null && _b !== void 0 ? _b : dataList[i - (params[0] - 1)]).close;
                hcy -= agoHigh - agoPreClose;
                cyl -= agoPreClose - agoLow;
                ho -= agoHigh - agoOpen;
                ol -= agoOpen - agoLow;
            }
            return brar;
        });
    }
};

const bullAndBearIndex: IndicatorDefinition = {
    name: 'BBI',
    series: 'price',
    precision: 2,
    calcParams: [3, 6, 12, 24],
    figures: [{ key: 'bbi', title: 'BBI: ', type: 'line' }],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        const maxPeriod = Math.max(...params);
        const closeSums: number[] = [];
        const mas: number[] = [];
        return dataList.map(function (kLineData, i) {
            const bbi: IndicatorValues = {};
            const close = kLineData.close;
            params.forEach(function (p, index) {
                let _a;
                closeSums[index] = ((_a = closeSums[index]) !== null && _a !== void 0 ? _a : 0) + close;
                if (i >= p - 1) {
                    mas[index] = closeSums[index] / p;
                    closeSums[index] -= dataList[i - (p - 1)].close;
                }
            });
            if (i >= maxPeriod - 1) {
                let maSum_1 = 0;
                mas.forEach(function (ma) {
                    maSum_1 += ma;
                });
                bbi.bbi = params.length > 0 ? maSum_1 / params.length : 0;
            }
            return bbi;
        });
    }
};

const commodityChannelIndex: IndicatorDefinition = {
    name: 'CCI',
    calcParams: [20],
    figures: [{ key: 'cci', title: 'CCI: ', type: 'line' }],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        const p = params[0] - 1;
        let tpSum = 0;
        const tpList: number[] = [];
        return dataList.map(function (kLineData, i) {
            const cci: IndicatorValues = {};
            const tp = (kLineData.high + kLineData.low + kLineData.close) / 3;
            tpSum += tp;
            tpList.push(tp);
            if (i >= p) {
                const maTp_1 = tpSum / params[0];
                const sliceTpList = tpList.slice(i - p, i + 1);
                let sum_1 = 0;
                sliceTpList.forEach(function (tp) {
                    sum_1 += Math.abs(tp - maTp_1);
                });
                const md = sum_1 / params[0];
                cci.cci = md !== 0 ? (tp - maTp_1) / md / 0.015 : 0;
                const agoTp = (dataList[i - p].high + dataList[i - p].low + dataList[i - p].close) / 3;
                tpSum -= agoTp;
            }
            return cci;
        });
    }
};

const currentRatio: IndicatorDefinition = {
    name: 'CR',
    calcParams: [26, 10, 20, 40, 60],
    figures: [
        { key: 'cr', title: 'CR: ', type: 'line' },
        { key: 'ma1', title: 'MA1: ', type: 'line' },
        { key: 'ma2', title: 'MA2: ', type: 'line' },
        { key: 'ma3', title: 'MA3: ', type: 'line' },
        { key: 'ma4', title: 'MA4: ', type: 'line' }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        const ma1ForwardPeriod = Math.ceil(params[1] / 2.5 + 1);
        const ma2ForwardPeriod = Math.ceil(params[2] / 2.5 + 1);
        const ma3ForwardPeriod = Math.ceil(params[3] / 2.5 + 1);
        const ma4ForwardPeriod = Math.ceil(params[4] / 2.5 + 1);
        let ma1Sum = 0;
        const ma1List: number[] = [];
        let ma2Sum = 0;
        const ma2List: number[] = [];
        let ma3Sum = 0;
        const ma3List: number[] = [];
        let ma4Sum = 0;
        const ma4List: number[] = [];
        let highSubSum = 0;
        let preMidSubSum = 0;
        const result: IndicatorValues[] = [];
        dataList.forEach(function (kLineData, i) {
            let _a, _b, _c, _d, _e, _f;
            const cr: IndicatorValues = {};
            const prevData = (_a = dataList[i - 1]) !== null && _a !== void 0 ? _a : kLineData;
            const prevMid = (prevData.high + prevData.low) / 2;
            const highSubPreMid = Math.max(0, kLineData.high - prevMid);
            const preMidSubLow = Math.max(0, prevMid - kLineData.low);
            highSubSum += highSubPreMid;
            preMidSubSum += preMidSubLow;
            if (i >= params[0]) {
                const outData = dataList[i - params[0]];
                const outPrevData = (_b = dataList[i - params[0] - 1]) !== null && _b !== void 0 ? _b : outData;
                const outPrevMid = (outPrevData.high + outPrevData.low) / 2;
                highSubSum -= Math.max(0, outData.high - outPrevMid);
                preMidSubSum -= Math.max(0, outPrevMid - outData.low);
            }
            if (i >= params[0] - 1) {
                if (preMidSubSum !== 0) {
                    cr.cr = (highSubSum / preMidSubSum) * 100;
                }
                else {
                    cr.cr = 0;
                }
                ma1Sum += cr.cr;
                ma2Sum += cr.cr;
                ma3Sum += cr.cr;
                ma4Sum += cr.cr;
                if (i >= params[0] + params[1] - 2) {
                    ma1List.push(ma1Sum / params[1]);
                    if (i >= params[0] + params[1] + ma1ForwardPeriod - 3) {
                        cr.ma1 = ma1List[ma1List.length - 1 - ma1ForwardPeriod];
                    }
                    ma1Sum -= (_c = result[i - (params[1] - 1)].cr) !== null && _c !== void 0 ? _c : 0;
                }
                if (i >= params[0] + params[2] - 2) {
                    ma2List.push(ma2Sum / params[2]);
                    if (i >= params[0] + params[2] + ma2ForwardPeriod - 3) {
                        cr.ma2 = ma2List[ma2List.length - 1 - ma2ForwardPeriod];
                    }
                    ma2Sum -= (_d = result[i - (params[2] - 1)].cr) !== null && _d !== void 0 ? _d : 0;
                }
                if (i >= params[0] + params[3] - 2) {
                    ma3List.push(ma3Sum / params[3]);
                    if (i >= params[0] + params[3] + ma3ForwardPeriod - 3) {
                        cr.ma3 = ma3List[ma3List.length - 1 - ma3ForwardPeriod];
                    }
                    ma3Sum -= (_e = result[i - (params[3] - 1)].cr) !== null && _e !== void 0 ? _e : 0;
                }
                if (i >= params[0] + params[4] - 2) {
                    ma4List.push(ma4Sum / params[4]);
                    if (i >= params[0] + params[4] + ma4ForwardPeriod - 3) {
                        cr.ma4 = ma4List[ma4List.length - 1 - ma4ForwardPeriod];
                    }
                    ma4Sum -= (_f = result[i - (params[4] - 1)].cr) !== null && _f !== void 0 ? _f : 0;
                }
            }
            result.push(cr);
        });
        return result;
    }
};

const differentOfMovingAverage: IndicatorDefinition = {
    name: 'DMA',
    calcParams: [10, 50, 10],
    figures: [
        { key: 'dma', title: 'DMA: ', type: 'line' },
        { key: 'ama', title: 'AMA: ', type: 'line' }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        const maxPeriod = Math.max(params[0], params[1]);
        let closeSum1 = 0;
        let closeSum2 = 0;
        let dmaSum = 0;
        const result: IndicatorValues[] = [];
        dataList.forEach(function (kLineData, i) {
            let _a;
            const dma: IndicatorValues = {};
            const close = kLineData.close;
            closeSum1 += close;
            closeSum2 += close;
            let ma1 = 0;
            let ma2 = 0;
            if (i >= params[0] - 1) {
                ma1 = closeSum1 / params[0];
                closeSum1 -= dataList[i - (params[0] - 1)].close;
            }
            if (i >= params[1] - 1) {
                ma2 = closeSum2 / params[1];
                closeSum2 -= dataList[i - (params[1] - 1)].close;
            }
            if (i >= maxPeriod - 1) {
                const dif = ma1 - ma2;
                dma.dma = dif;
                dmaSum += dif;
                if (i >= maxPeriod + params[2] - 2) {
                    dma.ama = dmaSum / params[2];
                    dmaSum -= (_a = result[i - (params[2] - 1)].dma) !== null && _a !== void 0 ? _a : 0;
                }
            }
            result.push(dma);
        });
        return result;
    }
};

const directionalMovementIndex: IndicatorDefinition = {
    name: 'DMI',
    calcParams: [14, 6],
    figures: [
        { key: 'pdi', title: 'PDI: ', type: 'line' },
        { key: 'mdi', title: 'MDI: ', type: 'line' },
        { key: 'adx', title: 'ADX: ', type: 'line' },
        { key: 'adxr', title: 'ADXR: ', type: 'line' }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        let trSum = 0;
        let hSum = 0;
        let lSum = 0;
        let mtr = 0;
        let dmp = 0;
        let dmm = 0;
        let dxSum = 0;
        let adx = 0;
        const result: IndicatorValues[] = [];
        dataList.forEach(function (kLineData, i) {
            let _a, _b;
            const dmi: IndicatorValues = {};
            const prevKLineData = (_a = dataList[i - 1]) !== null && _a !== void 0 ? _a : kLineData;
            const preClose = prevKLineData.close;
            const high = kLineData.high;
            const low = kLineData.low;
            const hl = high - low;
            const hcy = Math.abs(high - preClose);
            const lcy = Math.abs(preClose - low);
            const hhy = high - prevKLineData.high;
            const lyl = prevKLineData.low - low;
            const tr = Math.max(Math.max(hl, hcy), lcy);
            const h = hhy > 0 && hhy > lyl ? hhy : 0;
            const l = lyl > 0 && lyl > hhy ? lyl : 0;
            trSum += tr;
            hSum += h;
            lSum += l;
            if (i >= params[0] - 1) {
                if (i > params[0] - 1) {
                    mtr = mtr - mtr / params[0] + tr;
                    dmp = dmp - dmp / params[0] + h;
                    dmm = dmm - dmm / params[0] + l;
                }
                else {
                    mtr = trSum;
                    dmp = hSum;
                    dmm = lSum;
                }
                let pdi = 0;
                let mdi = 0;
                if (mtr !== 0) {
                    pdi = (dmp * 100) / mtr;
                    mdi = (dmm * 100) / mtr;
                }
                dmi.pdi = pdi;
                dmi.mdi = mdi;
                let dx = 0;
                if (mdi + pdi !== 0) {
                    dx = (Math.abs(mdi - pdi) / (mdi + pdi)) * 100;
                }
                dxSum += dx;
                if (i >= params[0] * 2 - 2) {
                    if (i > params[0] * 2 - 2) {
                        adx = (adx * (params[0] - 1) + dx) / params[0];
                    }
                    else {
                        adx = dxSum / params[0];
                    }
                    dmi.adx = adx;
                    if (i >= params[0] * 2 + params[1] - 3) {
                        dmi.adxr = (((_b = result[i - (params[1] - 1)].adx) !== null && _b !== void 0 ? _b : 0) + adx) / 2;
                    }
                }
            }
            result.push(dmi);
        });
        return result;
    }
};

const easeOfMovementValue: IndicatorDefinition = {
    name: 'EMV',
    calcParams: [14, 9],
    figures: [
        { key: 'emv', title: 'EMV: ', type: 'line' },
        { key: 'maEmv', title: 'MAEMV: ', type: 'line' }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        let emvValueSum = 0;
        const emvValueList: number[] = [];
        return dataList.map(function (kLineData, i) {
            let _a;
            const emv: IndicatorValues = {};
            if (i > 0) {
                const prevKLineData = dataList[i - 1];
                const high = kLineData.high;
                const low = kLineData.low;
                const volume = (_a = kLineData.volume) !== null && _a !== void 0 ? _a : 0;
                const distanceMoved = (high + low) / 2 - (prevKLineData.high + prevKLineData.low) / 2;
                if (volume === 0 || high - low === 0) {
                    emv.emv = 0;
                }
                else {
                    const ratio = volume / 100000000 / (high - low);
                    emv.emv = distanceMoved / ratio;
                }
                emvValueSum += emv.emv;
                emvValueList.push(emv.emv);
                if (i >= params[0]) {
                    emv.maEmv = emvValueSum / params[0];
                    emvValueSum -= emvValueList[i - params[0]];
                }
            }
            return emv;
        });
    }
};

const exponentialMovingAverage: IndicatorDefinition = {
    name: 'EMA',
    series: 'price',
    calcParams: [6, 12, 20],
    precision: 2,
    figures: [
        { key: 'ema1', title: 'EMA6: ', type: 'line' },
        { key: 'ema2', title: 'EMA12: ', type: 'line' },
        { key: 'ema3', title: 'EMA20: ', type: 'line' }
    ],
    regenerateFigures: function (params) { return params.map(function (p, i) { return ({ key: "ema".concat(String(i + 1)), title: "EMA".concat(String(p), ": "), type: 'line' }); }); },
    calc: function (dataList, indicator) {
        const params = indicator.calcParams, figures = indicator.figures;
        let closeSum = 0;
        const emaValues: number[] = [];
        return dataList.map(function (kLineData, i) {
            const ema: IndicatorValues = {};
            const close = kLineData.close;
            closeSum += close;
            params.forEach(function (p, index) {
                if (i >= p - 1) {
                    if (i > p - 1) {
                        emaValues[index] = (2 * close + (p - 1) * emaValues[index]) / (p + 1);
                    }
                    else {
                        emaValues[index] = closeSum / p;
                    }
                    ema[figures[index].key] = emaValues[index];
                }
            });
            return ema;
        });
    }
};

const momentum: IndicatorDefinition = {
    name: 'MTM',
    calcParams: [12, 6],
    figures: [
        { key: 'mtm', title: 'MTM: ', type: 'line' },
        { key: 'maMtm', title: 'MAMTM: ', type: 'line' }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        let mtmSum = 0;
        const result: IndicatorValues[] = [];
        dataList.forEach(function (kLineData, i) {
            let _a;
            const mtm: IndicatorValues = {};
            if (i >= params[0]) {
                const close_1 = kLineData.close;
                const agoClose = dataList[i - params[0]].close;
                mtm.mtm = close_1 - agoClose;
                mtmSum += mtm.mtm;
                if (i >= params[0] + params[1] - 1) {
                    mtm.maMtm = mtmSum / params[1];
                    mtmSum -= (_a = result[i - (params[1] - 1)].mtm) !== null && _a !== void 0 ? _a : 0;
                }
            }
            result.push(mtm);
        });
        return result;
    }
};

const movingAverage: IndicatorDefinition = {
    name: 'MA',
    series: 'price',
    calcParams: [5, 10, 30, 60],
    precision: 2,
    figures: [
        { key: 'ma1', title: 'MA5: ', type: 'line' },
        { key: 'ma2', title: 'MA10: ', type: 'line' },
        { key: 'ma3', title: 'MA30: ', type: 'line' },
        { key: 'ma4', title: 'MA60: ', type: 'line' }
    ],
    regenerateFigures: function (params) { return params.map(function (p, i) { return ({ key: "ma".concat(String(i + 1)), title: "MA".concat(String(p), ": "), type: 'line' }); }); },
    calc: function (dataList, indicator) {
        const params = indicator.calcParams, figures = indicator.figures;
        const closeSums: number[] = [];
        return dataList.map(function (kLineData, i) {
            const ma: IndicatorValues = {};
            const close = kLineData.close;
            params.forEach(function (p, index) {
                let _a;
                closeSums[index] = ((_a = closeSums[index]) !== null && _a !== void 0 ? _a : 0) + close;
                if (i >= p - 1) {
                    ma[figures[index].key] = closeSums[index] / p;
                    closeSums[index] -= dataList[i - (p - 1)].close;
                }
            });
            return ma;
        });
    }
};

const movingAverageConvergenceDivergence: IndicatorDefinition = {
    name: 'MACD',
    calcParams: [12, 26, 9],
    figures: [
        { key: 'dif', title: 'DIF: ', type: 'line' },
        { key: 'dea', title: 'DEA: ', type: 'line' },
        {
            key: 'macd',
            title: 'MACD: ',
            type: 'bar',
            baseValue: 0
        }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        let closeSum = 0;
        let emaShort = 0;
        let emaLong = 0;
        let dif = 0;
        let difSum = 0;
        let dea = 0;
        const maxPeriod = Math.max(params[0], params[1]);
        return dataList.map(function (kLineData, i) {
            const macd: IndicatorValues = {};
            const close = kLineData.close;
            closeSum += close;
            if (i >= params[0] - 1) {
                if (i > params[0] - 1) {
                    emaShort = (2 * close + (params[0] - 1) * emaShort) / (params[0] + 1);
                }
                else {
                    emaShort = closeSum / params[0];
                }
            }
            if (i >= params[1] - 1) {
                if (i > params[1] - 1) {
                    emaLong = (2 * close + (params[1] - 1) * emaLong) / (params[1] + 1);
                }
                else {
                    emaLong = closeSum / params[1];
                }
            }
            if (i >= maxPeriod - 1) {
                dif = emaShort - emaLong;
                macd.dif = dif;
                difSum += dif;
                if (i >= maxPeriod + params[2] - 2) {
                    if (i > maxPeriod + params[2] - 2) {
                        dea = (dif * 2 + dea * (params[2] - 1)) / (params[2] + 1);
                    }
                    else {
                        dea = difSum / params[2];
                    }
                    macd.macd = (dif - dea) * 2;
                    macd.dea = dea;
                }
            }
            return macd;
        });
    }
};

const onBalanceVolume: IndicatorDefinition = {
    name: 'OBV',
    calcParams: [30],
    figures: [
        { key: 'obv', title: 'OBV: ', type: 'line' },
        { key: 'maObv', title: 'MAOBV: ', type: 'line' }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        let obvSum = 0;
        let oldObv = 0;
        const result: IndicatorValues[] = [];
        dataList.forEach(function (kLineData, i) {
            let _a, _b, _c, _d;
            const prevKLineData = (_a = dataList[i - 1]) !== null && _a !== void 0 ? _a : kLineData;
            if (kLineData.close < prevKLineData.close) {
                oldObv -= (_b = kLineData.volume) !== null && _b !== void 0 ? _b : 0;
            }
            else if (kLineData.close > prevKLineData.close) {
                oldObv += (_c = kLineData.volume) !== null && _c !== void 0 ? _c : 0;
            }
            const obv: IndicatorValues = { obv: oldObv };
            obvSum += oldObv;
            if (i >= params[0] - 1) {
                obv.maObv = obvSum / params[0];
                obvSum -= (_d = result[i - (params[0] - 1)].obv) !== null && _d !== void 0 ? _d : 0;
            }
            result.push(obv);
        });
        return result;
    }
};

const priceAndVolumeTrend: IndicatorDefinition = {
    name: 'PVT',
    figures: [{ key: 'pvt', title: 'PVT: ', type: 'line' }],
    calc: function (dataList) {
        let sum = 0;
        return dataList.map(function (kLineData, i) {
            let _a, _b;
            const pvt: IndicatorValues = {};
            const close = kLineData.close;
            const volume = (_a = kLineData.volume) !== null && _a !== void 0 ? _a : 1;
            const prevClose = ((_b = dataList[i - 1]) !== null && _b !== void 0 ? _b : kLineData).close;
            let x = 0;
            if (prevClose !== 0) {
                x = ((close - prevClose) / prevClose) * volume;
            }
            sum += x;
            pvt.pvt = sum;
            return pvt;
        });
    }
};

const psychologicalLine: IndicatorDefinition = {
    name: 'PSY',
    calcParams: [12, 6],
    figures: [
        { key: 'psy', title: 'PSY: ', type: 'line' },
        { key: 'maPsy', title: 'MAPSY: ', type: 'line' }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        let upCount = 0;
        let psySum = 0;
        const upList: number[] = [];
        const result: IndicatorValues[] = [];
        dataList.forEach(function (kLineData, i) {
            let _a, _b;
            const psy: IndicatorValues = {};
            const prevClose = ((_a = dataList[i - 1]) !== null && _a !== void 0 ? _a : kLineData).close;
            const upFlag = kLineData.close - prevClose > 0 ? 1 : 0;
            upList.push(upFlag);
            upCount += upFlag;
            if (i >= params[0] - 1) {
                psy.psy = (upCount / params[0]) * 100;
                psySum += psy.psy;
                if (i >= params[0] + params[1] - 2) {
                    psy.maPsy = psySum / params[1];
                    psySum -= (_b = result[i - (params[1] - 1)].psy) !== null && _b !== void 0 ? _b : 0;
                }
                upCount -= upList[i - (params[0] - 1)];
            }
            result.push(psy);
        });
        return result;
    }
};

const rateOfChange: IndicatorDefinition = {
    name: 'ROC',
    calcParams: [12, 6],
    figures: [
        { key: 'roc', title: 'ROC: ', type: 'line' },
        { key: 'maRoc', title: 'MAROC: ', type: 'line' }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        const result: IndicatorValues[] = [];
        let rocSum = 0;
        dataList.forEach(function (kLineData, i) {
            let _a;
            const roc: IndicatorValues = {};
            if (i >= params[0]) {
                const close_1 = kLineData.close;
                const agoClose = dataList[i - params[0]].close;
                if (agoClose !== 0) {
                    roc.roc = ((close_1 - agoClose) / agoClose) * 100;
                }
                else {
                    roc.roc = 0;
                }
                rocSum += roc.roc;
                if (i >= params[0] + params[1] - 1) {
                    roc.maRoc = rocSum / params[1];
                    rocSum -= (_a = result[i - (params[1] - 1)].roc) !== null && _a !== void 0 ? _a : 0;
                }
            }
            result.push(roc);
        });
        return result;
    }
};

const relativeStrengthIndex: IndicatorDefinition = {
    name: 'RSI',
    calcParams: [6, 12, 24],
    figures: [
        { key: 'rsi1', title: 'RSI1: ', type: 'line' },
        { key: 'rsi2', title: 'RSI2: ', type: 'line' },
        { key: 'rsi3', title: 'RSI3: ', type: 'line' }
    ],
    regenerateFigures: function (params) {
        return params.map(function (_, index) {
            const num = index + 1;
            return { key: "rsi".concat(String(num)), title: "RSI".concat(String(num), ": "), type: 'line' };
        });
    },
    calc: function (dataList, indicator) {
        const params = indicator.calcParams, figures = indicator.figures;
        const gainSums: number[] = [];
        const lossSums: number[] = [];
        const avgGains: number[] = [];
        const avgLosses: number[] = [];
        return dataList.map(function (kLineData, i) {
            const rsi: IndicatorValues = {};
            const change = i === 0 ? 0 : kLineData.close - dataList[i - 1].close;
            const gain = Math.max(change, 0);
            const loss = Math.max(-change, 0);
            params.forEach(function (p, index) {
                let _a, _b;
                gainSums[index] = ((_a = gainSums[index]) !== null && _a !== void 0 ? _a : 0) + gain;
                lossSums[index] = ((_b = lossSums[index]) !== null && _b !== void 0 ? _b : 0) + loss;
                if (i < p) {
                    return;
                }
                if (avgGains[index] === undefined || avgLosses[index] === undefined) {
                    avgGains[index] = gainSums[index] / p;
                    avgLosses[index] = lossSums[index] / p;
                }
                else {
                    avgGains[index] = (avgGains[index] * (p - 1) + gain) / p;
                    avgLosses[index] = (avgLosses[index] * (p - 1) + loss) / p;
                }
                if (avgLosses[index] === 0) {
                    rsi[figures[index].key] = 100;
                }
                else if (avgGains[index] === 0) {
                    rsi[figures[index].key] = 0;
                }
                else {
                    rsi[figures[index].key] = 100 - 100 / (1 + avgGains[index] / avgLosses[index]);
                }
            });
            return rsi;
        });
    }
};

const simpleMovingAverage: IndicatorDefinition = {
    name: 'SMA',
    series: 'price',
    calcParams: [12, 2],
    precision: 2,
    figures: [{ key: 'sma', title: 'SMA: ', type: 'line' }],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        let closeSum = 0;
        let smaValue = 0;
        return dataList.map(function (kLineData, i) {
            const sma: IndicatorValues = {};
            const close = kLineData.close;
            closeSum += close;
            if (i >= params[0] - 1) {
                if (i > params[0] - 1) {
                    smaValue = (close * params[1] + smaValue * (params[0] - params[1] + 1)) / (params[0] + 1);
                }
                else {
                    smaValue = closeSum / params[0];
                }
                sma.sma = smaValue;
            }
            return sma;
        });
    }
};

const stoch: IndicatorDefinition = {
    name: 'KDJ',
    calcParams: [9, 3, 3],
    figures: [
        { key: 'k', title: 'K: ', type: 'line' },
        { key: 'd', title: 'D: ', type: 'line' },
        { key: 'j', title: 'J: ', type: 'line' }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        const result: IndicatorValues[] = [];
        dataList.forEach(function (kLineData, i) {
            let _a, _b, _c, _d;
            const kdj: IndicatorValues = {};
            const close = kLineData.close;
            if (i >= params[0] - 1) {
                const lhn = getMaxMin(dataList.slice(i - (params[0] - 1), i + 1), 'high', 'low');
                const hn = lhn[0];
                const ln = lhn[1];
                const hnSubLn = hn - ln;
                const rsv = ((close - ln) / (hnSubLn === 0 ? 1 : hnSubLn)) * 100;
                kdj.k = ((params[1] - 1) * ((_b = (_a = result[i - 1]) === null || _a === void 0 ? void 0 : _a.k) !== null && _b !== void 0 ? _b : 50) + rsv) / params[1];
                kdj.d = ((params[2] - 1) * ((_d = (_c = result[i - 1]) === null || _c === void 0 ? void 0 : _c.d) !== null && _d !== void 0 ? _d : 50) + kdj.k) / params[2];
                kdj.j = 3.0 * kdj.k - 2.0 * kdj.d;
            }
            result.push(kdj);
        });
        return result;
    }
};

const stopAndReverse: IndicatorDefinition = {
    name: 'SAR',
    series: 'price',
    calcParams: [2, 2, 20],
    precision: 2,
    figures: [
        {
            key: 'sar',
            title: 'SAR: ',
            type: 'circle'
        }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        const startAf = params[0] / 100;
        const step = params[1] / 100;
        const maxAf = params[2] / 100;
        let af = startAf;
        let ep = -100;
        let isIncreasing = false;
        let sar = 0;
        return dataList.map(function (kLineData, i) {
            const preSar = sar;
            const high = kLineData.high;
            const low = kLineData.low;
            if (isIncreasing) {
                if (ep === -100 || ep < high) {
                    ep = high;
                    af = Math.min(af + step, maxAf);
                }
                sar = preSar + af * (ep - preSar);
                const lowMin = Math.min(dataList[Math.max(1, i) - 1].low, low);
                if (sar > kLineData.low) {
                    sar = ep;
                    af = startAf;
                    ep = -100;
                    isIncreasing = !isIncreasing;
                }
                else if (sar > lowMin) {
                    sar = lowMin;
                }
            }
            else {
                if (ep === -100 || ep > low) {
                    ep = low;
                    af = Math.min(af + step, maxAf);
                }
                sar = preSar + af * (ep - preSar);
                const highMax = Math.max(dataList[Math.max(1, i) - 1].high, high);
                if (sar < kLineData.high) {
                    sar = ep;
                    af = startAf;
                    ep = -100;
                    isIncreasing = !isIncreasing;
                }
                else if (sar < highMax) {
                    sar = highMax;
                }
            }
            return { high: high, low: low, sar: sar };
        });
    }
};

const tripleExponentiallySmoothedAverage: IndicatorDefinition = {
    name: 'TRIX',
    calcParams: [12, 9],
    figures: [
        { key: 'trix', title: 'TRIX: ', type: 'line' },
        { key: 'maTrix', title: 'MATRIX: ', type: 'line' }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        let closeSum = 0;
        let ema1 = 0;
        let ema2 = 0;
        let oldTr = 0;
        let ema1Sum = 0;
        let ema2Sum = 0;
        let trixSum = 0;
        const result: IndicatorValues[] = [];
        dataList.forEach(function (kLineData, i) {
            let _a;
            const trix: IndicatorValues = {};
            const close = kLineData.close;
            closeSum += close;
            if (i >= params[0] - 1) {
                if (i > params[0] - 1) {
                    ema1 = (2 * close + (params[0] - 1) * ema1) / (params[0] + 1);
                }
                else {
                    ema1 = closeSum / params[0];
                }
                ema1Sum += ema1;
                if (i >= params[0] * 2 - 2) {
                    if (i > params[0] * 2 - 2) {
                        ema2 = (2 * ema1 + (params[0] - 1) * ema2) / (params[0] + 1);
                    }
                    else {
                        ema2 = ema1Sum / params[0];
                    }
                    ema2Sum += ema2;
                    if (i >= params[0] * 3 - 3) {
                        let tr = 0;
                        let trixValue = 0;
                        if (i > params[0] * 3 - 3) {
                            tr = (2 * ema2 + (params[0] - 1) * oldTr) / (params[0] + 1);
                            trixValue = ((tr - oldTr) / oldTr) * 100;
                        }
                        else {
                            tr = ema2Sum / params[0];
                        }
                        oldTr = tr;
                        trix.trix = trixValue;
                        trixSum += trixValue;
                        if (i >= params[0] * 3 + params[1] - 4) {
                            trix.maTrix = trixSum / params[1];
                            trixSum -= (_a = result[i - (params[1] - 1)].trix) !== null && _a !== void 0 ? _a : 0;
                        }
                    }
                }
            }
            result.push(trix);
        });
        return result;
    }
};

const volume: IndicatorDefinition = {
    name: 'VOL',
    series: 'volume',
    calcParams: [5, 10, 20],
    precision: 0,
    minValue: 0,
    figures: [{ key: 'ma1', title: 'MA5: ', type: 'line' }, { key: 'ma2', title: 'MA10: ', type: 'line' }, { key: 'ma3', title: 'MA20: ', type: 'line' }, getVolumeFigure()],
    regenerateFigures: function (params) {
        const figures: IndicatorFigure[] = params.map(function (p, i) { return ({ key: "ma".concat(String(i + 1)), title: "MA".concat(String(p), ": "), type: 'line' }); });
        figures.push(getVolumeFigure());
        return figures;
    },
    calc: function (dataList, indicator) {
        const params = indicator.calcParams, figures = indicator.figures;
        const volSums: number[] = [];
        return dataList.map(function (kLineData, i) {
            let _a;
            const volume = (_a = kLineData.volume) !== null && _a !== void 0 ? _a : 0;
            const vol: IndicatorValues = { volume: volume, open: kLineData.open, close: kLineData.close };
            params.forEach(function (p, index) {
                let _a, _b;
                volSums[index] = ((_a = volSums[index]) !== null && _a !== void 0 ? _a : 0) + volume;
                if (i >= p - 1) {
                    vol[figures[index].key] = volSums[index] / p;
                    volSums[index] -= (_b = dataList[i - (p - 1)].volume) !== null && _b !== void 0 ? _b : 0;
                }
            });
            return vol;
        });
    }
};

const volumeRatio: IndicatorDefinition = {
    name: 'VR',
    calcParams: [26, 6],
    figures: [
        { key: 'vr', title: 'VR: ', type: 'line' },
        { key: 'maVr', title: 'MAVR: ', type: 'line' }
    ],
    calc: function (dataList, indicator) {
        const params = indicator.calcParams;
        let uvs = 0;
        let dvs = 0;
        let pvs = 0;
        let vrSum = 0;
        const result: IndicatorValues[] = [];
        dataList.forEach(function (kLineData, i) {
            let _a, _b, _c, _d, _e;
            const vr: IndicatorValues = {};
            const close = kLineData.close;
            const preClose = ((_a = dataList[i - 1]) !== null && _a !== void 0 ? _a : kLineData).close;
            const volume = (_b = kLineData.volume) !== null && _b !== void 0 ? _b : 0;
            if (close > preClose) {
                uvs += volume;
            }
            else if (close < preClose) {
                dvs += volume;
            }
            else {
                pvs += volume;
            }
            if (i >= params[0] - 1) {
                const halfPvs = pvs / 2;
                if (dvs + halfPvs === 0) {
                    vr.vr = 0;
                }
                else {
                    vr.vr = ((uvs + halfPvs) / (dvs + halfPvs)) * 100;
                }
                vrSum += vr.vr;
                if (i >= params[0] + params[1] - 2) {
                    vr.maVr = vrSum / params[1];
                    vrSum -= (_c = result[i - (params[1] - 1)].vr) !== null && _c !== void 0 ? _c : 0;
                }
                const agoData = dataList[i - (params[0] - 1)];
                const agoPreData = (_d = dataList[i - params[0]]) !== null && _d !== void 0 ? _d : agoData;
                const agoClose = agoData.close;
                const agoVolume = (_e = agoData.volume) !== null && _e !== void 0 ? _e : 0;
                if (agoClose > agoPreData.close) {
                    uvs -= agoVolume;
                }
                else if (agoClose < agoPreData.close) {
                    dvs -= agoVolume;
                }
                else {
                    pvs -= agoVolume;
                }
            }
            result.push(vr);
        });
        return result;
    }
};

const williamsR: IndicatorDefinition = {
    name: 'WR',
    calcParams: [6, 10, 14],
    figures: [
        { key: 'wr1', title: 'WR1: ', type: 'line' },
        { key: 'wr2', title: 'WR2: ', type: 'line' },
        { key: 'wr3', title: 'WR3: ', type: 'line' }
    ],
    regenerateFigures: function (params) { return params.map(function (_, i) { return ({ key: "wr".concat(String(i + 1)), title: "WR".concat(String(i + 1), ": "), type: 'line' }); }); },
    calc: function (dataList, indicator) {
        const params = indicator.calcParams, figures = indicator.figures;
        return dataList.map(function (kLineData, i) {
            const wr: IndicatorValues = {};
            const close = kLineData.close;
            params.forEach(function (param, index) {
                const p = param - 1;
                if (i >= p) {
                    const hln = getMaxMin(dataList.slice(i - p, i + 1), 'high', 'low');
                    const hn = hln[0];
                    const ln = hln[1];
                    const hnSubLn = hn - ln;
                    wr[figures[index].key] = hnSubLn === 0 ? 0 : ((close - hn) / hnSubLn) * 100;
                }
            });
            return wr;
        });
    }
};

export const INDICATOR_DEFINITIONS: readonly IndicatorDefinition[] = [averagePrice, awesomeOscillator, bias, bollingerBands, brar, bullAndBearIndex, commodityChannelIndex, currentRatio, differentOfMovingAverage, directionalMovementIndex, easeOfMovementValue, exponentialMovingAverage, momentum, movingAverage, movingAverageConvergenceDivergence, onBalanceVolume, priceAndVolumeTrend, psychologicalLine, rateOfChange, relativeStrengthIndex, simpleMovingAverage, stoch, stopAndReverse, tripleExponentiallySmoothedAverage, volume, volumeRatio, williamsR];
