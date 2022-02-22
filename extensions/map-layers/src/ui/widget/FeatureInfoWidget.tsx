/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { PropertyGrid} from "@itwin/components-react";
import { FillCentered, Orientation } from "@itwin/core-react";

import { FeatureInfoDataProvider, MapFeatureInfoDataUpdate, MapFeatureInfoLoadState } from "./FeatureInfoDataProvider";
import { ProgressRadial } from "@itwin/itwinui-react";
import { MapFeatureInfoOptions } from "../Interfaces";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";

interface MapFeatureInfoWidgetProps {
  featureInfoOpts?: MapFeatureInfoOptions;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapFeatureInfoWidget(props: MapFeatureInfoWidgetProps) {

  const dataProvider = React.useRef<FeatureInfoDataProvider>();
  const [loadingData, setLoadingData] = React.useState<boolean>(false);
  const [hasData, setHasData] = React.useState<boolean>(false);
  const [noRecordsMessage] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:FeatureInfoWidget.NoRecords"));

  const handleLoadStateChange = (state: MapFeatureInfoLoadState) => {
    setLoadingData(state === MapFeatureInfoLoadState.DataLoadStart);
  };
  const handleDataUpdated = (state: MapFeatureInfoDataUpdate) => {
    setHasData(state.recordCount !== 0);
  };

  React.useEffect(() => {
    dataProvider.current = new FeatureInfoDataProvider();
    return () => {
      dataProvider?.current?.onUnload();
    };
  }, []);

  React.useEffect(() => {

    dataProvider.current?.onDataUpdated.addListener(handleDataUpdated);
    return () => {
      dataProvider.current?.onDataUpdated.removeListener(handleDataUpdated);
    };

  }, []);

  React.useEffect(() => {
    if (props.featureInfoOpts?.showLoadProgressAnimation) {
      dataProvider.current?.onDataLoadStateChanged.addListener(handleLoadStateChange);
      return () => {
        dataProvider.current?.onDataLoadStateChanged.removeListener(handleLoadStateChange);
      };
    }
    return;

  }, [ props.featureInfoOpts?.showLoadProgressAnimation]);

  if (loadingData) {
    return (<FillCentered><ProgressRadial indeterminate={true}></ProgressRadial></FillCentered>);
  } else if (!hasData) {
    return (<FillCentered><span><i>{noRecordsMessage}</i></span></FillCentered>);
  } else{
    if (dataProvider.current)
      return (<PropertyGrid dataProvider={dataProvider.current} orientation={Orientation.Vertical}
        isPropertySelectionEnabled={props.featureInfoOpts?.propertyGridOptions?.isPropertySelectionEnabled} />);
    else
      return (<></>);
  }
}