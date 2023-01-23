/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Text
 */

import * as React from "react";
import { StyledText } from "./StyledText";
import { TextProps } from "./TextProps";

/** Styled small text React functional component
 * @public
 * @deprecated in 3.0. Use Small in itwinui-react instead
 */
export function SmallText(props: TextProps) {
  return <StyledText {...props} mainClassName="uicore-text-small" />;
}
