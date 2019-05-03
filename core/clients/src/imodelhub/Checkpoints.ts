/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { GuidString, Logger } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";
import { FileHandler } from "../FileHandler";
import { ClientsLoggerCategory } from "../ClientsLoggerCategory";
import { ProgressInfo } from "../Request";
import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck, IModelHubClientError } from "./Errors";
import { addSelectFileAccessKey, Query } from "./Query";

const loggerCategory: string = ClientsLoggerCategory.IModelHub;

/**
 * Checkpoint is a copy of the master file, that is intended to be read-only and reduces amount of merging required to get an iModel to a specific previous state.
 *
 * File properties describe the file that would be downloaded through downloadUrl.
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.Checkpoint", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class Checkpoint extends WsgInstance {
  /** File name of the master file. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileName")
  public fileName?: string;

  /** Description of the master file. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileDescription")
  public fileDescription?: string;

  /** Size of the checkpoint file. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileSize")
  public fileSize?: string;

  /** FileId of the master file. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileId")
  public fileId?: GuidString;

  /** Id of the last [[ChangeSet]] that was merged into this checkpoint file. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.MergedChangeSetId")
  public mergedChangeSetId?: string;

  /** Date when this checkpoint file was created. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedDate")
  public createdDate?: string;

  /** URL that can be used to download the checkpoint file from iModelHub. See [[CheckpointQuery.selectDownloadUrl]]. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FileAccessKey].relatedInstance[AccessKey].properties.DownloadUrl")
  public downloadUrl?: string;
}

/**
 * Query object for getting [[Checkpoint]]s. You can use this to modify the [[CheckpointHandler.get]] results.
 * @internal
 */
export class CheckpointQuery extends Query {
  /** Query will return closest [[Checkpoint]] to target [[ChangeSet]], based on ChangeSets size.
   * This query can return a Checkpoint that is ahead of the specified ChangeSet, if reversing ChangeSets would be faster than merging forward.
   * @returns This query.
   */
  public nearestCheckpoint(targetChangeSetId: string): this {
    this.filter(`NearestCheckpoint-backward-ChangeSet.Id+eq+'${targetChangeSetId}'`);
    return this;
  }

  /** Query will return closest [[Checkpoint]] to target [[ChangeSet]] that does not exceed the specified ChangeSet.
   * This query returns a closest Checkpoint that will reach target ChangeSet by only merging forward.
   * @returns This query.
   */
  public precedingCheckpoint(targetChangeSetId: string): this {
    this.filter(`PrecedingCheckpoint-backward-ChangeSet.Id+eq+'${targetChangeSetId}'`);
    return this;
  }

  /** Query will additionally select [[Checkpoint]] file download URL. This is needed to use the Checkpoint object with [[CheckpointHandler.download]].
   * @returns This query.
   */
  public selectDownloadUrl(): this {
    addSelectFileAccessKey(this._query);
    return this;
  }
}

/**
 * Handler for managing [[Checkpoint]]s. Use [[IModelClient.checkpoints]] to get an instance of this class.
 * In most cases, you should use [IModelDb]($backend) methods instead.
 * @internal
 */
export class CheckpointHandler {
  private _handler: IModelBaseHandler;
  private _fileHandler?: FileHandler;

  /** Constructor for CheckpointHandler. Use [[IModelClient]] instead of directly constructing this.
   * @param handler Handler for WSG requests.
   * @param fileHandler Handler for file system.
   * @internal
   */
  constructor(handler: IModelBaseHandler, fileHandler?: FileHandler) {
    this._handler = handler;
    this._fileHandler = fileHandler;
  }

  /** Get relative url for Checkpoint requests.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @internal
   */
  private getRelativeUrl(iModelId: GuidString) {
    return `/Repositories/iModel--${iModelId}/iModelScope/Checkpoint`;
  }

  /** Get the [[Checkpoint]]s.
   * @param requestContext The client request context
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param query Optional query object to filter the queried Checkpoints or select different data from them.
   * @returns Checkpoints that match the query.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, query: CheckpointQuery = new CheckpointQuery()): Promise<Checkpoint[]> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Querying checkpoints for iModel", () => ({ iModelId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("iModelId", iModelId);

    const checkpoints = await this._handler.getInstances<Checkpoint>(requestContext, Checkpoint, this.getRelativeUrl(iModelId), query.getQueryOptions());
    requestContext.enter();

    Logger.logTrace(loggerCategory, "Queried checkpoints for iModel", () => ({ iModelId, count: checkpoints.length }));
    return checkpoints;
  }

  /** Download the specified checkpoint file. This only downloads the file and does not update the [[Checkpoint]] id. Use [IModelDb.open]($backend) instead if you want to get a usable checkpoint file.
   * This method does not work on the browser. Directory containing the Checkpoint file is created if it does not exist. If there is an error during download, any partially downloaded file is deleted from disk.
   * @param requestContext The client request context
   * @param checkpoint Checkpoint to download. This needs to include a download link. See [[CheckpointQuery.selectDownloadUrl]].
   * @param path Path where checkpoint file should be downloaded, including filename.
   * @param progressCallback Callback for tracking progress.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined or has an invalid value.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.NotSupportedInBrowser]($bentley) if called in a browser.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.FileHandlerNotSet]($bentley) if [[FileHandler]] instance was not set for [[IModelClient]].
   * @throws [[ResponseError]] if the checkpoint cannot be downloaded.
   */
  public async download(requestContext: AuthorizedClientRequestContext, checkpoint: Checkpoint, path: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Started downloading checkpoint", () => ({ ...checkpoint, path }));
    ArgumentCheck.defined("checkpoint", checkpoint);
    ArgumentCheck.defined("path", path);

    if (typeof window !== "undefined")
      return Promise.reject(IModelHubClientError.browser());

    if (!this._fileHandler)
      return Promise.reject(IModelHubClientError.fileHandler());

    if (!checkpoint.downloadUrl)
      return Promise.reject(IModelHubClientError.missingDownloadUrl("checkpoint"));

    await this._fileHandler.downloadFile(requestContext, checkpoint.downloadUrl, path, parseInt(checkpoint.fileSize!, 10), progressCallback);
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Finished downloading checkpoint", () => ({ ...checkpoint, path }));
  }
}
