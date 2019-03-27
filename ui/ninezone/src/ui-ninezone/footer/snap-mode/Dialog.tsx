/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../utilities/Props";
import { TrianglePopover } from "../../popup/popover/Triangle";
import { Direction } from "../../utilities/Direction";
import "./Dialog.scss";

/** Properties of [[SnapModeDialogContent]] component. */
export interface SnapModeDialogContentProps extends CommonProps, NoChildrenProps {
  /** Actual snap rows. See [[Snap]] component. */
  snaps?: React.ReactNode;
  /** Dialog title. */
  title?: string;
}

/** Dialog content used in [[SnapModeDialog]] component. */
export class SnapModeDialogContent extends React.PureComponent<SnapModeDialogContentProps> {
  public render() {
    const className = classnames(
      "nz-footer-snapMode-dialogContent",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-title">
          {this.props.title}
        </div>
        <div className="nz-snaps">
          {this.props.snaps}
        </div>
      </div>
    );
  }
}

/** Properties of [[SnapModeDialog]] component. */
export interface SnapModeDialogProps extends CommonProps, NoChildrenProps {
  /** Dialog content. See [[SnapModeDialogContent]] */
  content?: React.ReactNode;
}

/** Dialog used in [[SnapModeIndicator]] component. */
export class SnapModeDialog extends React.PureComponent<SnapModeDialogProps> {
  public render() {
    const dialogClassName = classnames(
      "nz-footer-snapMode-dialog",
      this.props.className);

    return (
      <TrianglePopover
        className={dialogClassName}
        content={this.props.content}
        direction={Direction.Top}
        style={this.props.style}
      />
    );
  }
}
