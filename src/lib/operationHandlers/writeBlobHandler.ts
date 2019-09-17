import { WacLdpTask, TaskType } from '../api/http/HttpParser'
import { WacLdpResponse, ErrorResult, ResultType } from '../api/http/HttpResponder'

import Debug from 'debug'

import { getResourceDataAndCheckETag } from './getResourceDataAndCheckETag'
import { makeResourceData, objectToStream } from '../rdf/ResourceDataUtils'
import { StoreManager } from '../rdf/StoreManager'
import { ACL } from '../rdf/rdf-constants'
import IResourceIdentifier from 'solid-server-ts/src/ldp/IResourceIdentifier'
import IRepresentationPreferences from 'solid-server-ts/src/ldp/IRepresentationPreferences'

const debug = Debug('write-blob-handler')

export class WriteBlobHandler {
  constructor(method: string, target: IResourceIdentifier, representationPreferences: IRepresentationPreferences, task: WacLdpTask, resourceStore: StoreManager) {}
  canHandle = (wacLdpTask: WacLdpTask) => (wacLdpTask.wacLdpTaskType() === TaskType.blobWrite)
  requiredPermissions = [ ACL.Write ]
  handle = async function (task: WacLdpTask, storeManager: StoreManager, aud: string, skipWac: boolean, appendOnly: boolean): Promise<WacLdpResponse> {
    const resourceDataBefore = await getResourceDataAndCheckETag(task, storeManager)
    const blobExists: boolean = !!resourceDataBefore
    debug('operation writeBlob!', blobExists)
    // see https://github.com/inrupt/wac-ldp/issues/61
    // and https://github.com/inrupt/wac-ldp/issues/60
    const ifMatchHeaderPresent = task.ifMatch() || task.ifNoneMatchStar()
    debug('checking If-Match presence', ifMatchHeaderPresent, task.ifMatch(), task.ifNoneMatchStar(), task.ifMatchRequired, blobExists)
    if (blobExists || (task.ifMatchRequired && !ifMatchHeaderPresent)) {
      debug('attempt to overwrite existing resource')
      throw new ErrorResult(ResultType.PreconditionRequired)
    }
    const resultType = (blobExists ? ResultType.OkayWithoutBody : ResultType.Created)
    const contentType: string | undefined = task.contentType()
    debug('contentType', contentType)
    const resourceData = makeResourceData(contentType ? contentType : '', await task.requestBody())
    await storeManager.setResourceData(task.fullUrl(), objectToStream(resourceData))
    debug('write blob handler changed a resource', task.fullUrl())
    return {
      resultType,
      createdLocation: (blobExists ? undefined : task.fullUrl()),
      resourcesChanged: [ task.fullUrl() ]
    } as WacLdpResponse
  }
}
