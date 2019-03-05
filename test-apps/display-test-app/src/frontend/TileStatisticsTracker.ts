/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  TileAdmin,
  Viewport,
} from "@bentley/imodeljs-frontend";
import { createCheckBox } from "./CheckBox";
import { createNumericInput } from "./NumericInput";

const enum StatIndex {
  Active,
  Pending,
  Canceled,
  Total,
  Selected,
  Ready,
  Progress,
  Completed,
  TimedOut,
  Failed,

  COUNT,
}

const statLabels = [
  "Active Requests",
  "Pending Requests",
  "Canceled",
  "Total Requests",
  "Selected Tiles",
  "Ready Tiles",
  "Progress",
  "Completed",
  "Timed Out",
  "Failed",
];

type GetStat = (stats: TileAdmin.Statistics, vp: Viewport) => number;

const getStat: GetStat[] = [
  (stats, _vp) => stats.numActiveRequests,
  (stats, _vp) => stats.numPendingRequests,
  (stats, _vp) => stats.numCanceled,
  (stats, _vp) => stats.numActiveRequests + stats.numPendingRequests,
  (_stats, vp) => vp.numSelectedTiles,
  (_stats, vp) => vp.numReadyTiles,
  (_stats, vp) => {
    const ready = vp.numReadyTiles;
    const requested = vp.numRequestedTiles;
    const total = ready + requested;
    const ratio = (total > 0) ? (ready / total) : 1.0;
    return Math.round(ratio * 100);
  },
  (stats, _vp) => stats.totalCompletedRequests,
  (stats, _vp) => stats.totalTimedOutRequests,
  (stats, _vp) => stats.totalFailedRequests,
];

export class StatsTracker {
  private readonly _statElements: HTMLElement[] = [];
  private readonly _div: HTMLDivElement;
  private readonly _vp: Viewport;
  private _curIntervalId?: NodeJS.Timer;

  public constructor(parent: HTMLElement, vp: Viewport) {
    this._vp = vp;
    this.addMaxActive(parent);
    createCheckBox({
      parent,
      name: "Track Tile Requests",
      id: "stats_trackMemory",
      handler: (_cb) => this.toggle(),
    });

    this._div = document.createElement("div") as HTMLDivElement;
    this._div.style.display = "none";
    this._div.style.textAlign = "right";

    for (let i = 0; i < StatIndex.COUNT; i++) {
      const div = document.createElement("div");
      const elem = document.createElement("text");
      this._statElements[i] = elem;
      div.appendChild(elem);
      this._div.appendChild(div);
    }

    parent.appendChild(this._div);
  }

  public dispose(): void {
    this.clearInterval();
  }

  private addMaxActive(parent: HTMLElement): void {
    const div = document.createElement("div");

    const label = document.createElement("label") as HTMLLabelElement;
    label.style.display = "inline";
    label.htmlFor = "maxActiveRequests";
    label.innerText = "Max Active Requests: ";
    div.appendChild(label);

    createNumericInput({
      parent: div,
      id: "maxActiveRequests",
      display: "inline",
      min: 0,
      step: 1,
      value: IModelApp.tileAdmin.maxActiveRequests,
      handler: (value, _input) => this.updateMaxActive(value),
    });

    parent.appendChild(div);
  }

  private updateMaxActive(value: number): void {
    IModelApp.tileAdmin.maxActiveRequests = value;
  }

  private clearInterval(): void {
    if (undefined !== this._curIntervalId) {
      clearInterval(this._curIntervalId);
      this._curIntervalId = undefined;
    }
  }

  private toggle(): void {
    if (undefined !== this._curIntervalId) {
      // Currently on - turn off.
      this._div.style.display = "none";
      this.clearInterval();
    } else {
      // Currently off - turn on.
      this._div.style.display = "block";
      this.update();
      this._curIntervalId = setInterval(() => this.update(), 500);
    }
  }

  private update(): void {
    const stats = IModelApp.tileAdmin.statistics;
    for (let i = 0; i < StatIndex.COUNT; i++) {
      const label = statLabels[i] + ": " + getStat[i](stats, this._vp);
      this._statElements[i].innerText = label;
    }
  }
}
