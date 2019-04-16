import Debug from 'debug'
import { LdpResponse, ResultType } from '../api/http/HttpResponder'
import { LdpTask } from '../api/http/HttpParser'
import { BlobTree } from '../storage/BlobTree'
import { Blob } from '../storage/Blob'

const debug = Debug('readBlob')

async function fromStream (stream: ReadableStream): Promise<any> {
  let readResult
  let str = ''
  let value
  const reader = stream.getReader()
  do {
    readResult = await reader.read()
    str += readResult.value
  } while (!readResult.done)
  let obj
  try {
    obj = JSON.parse(str)
  } catch (error) {
    throw new Error('string in stream is not JSON')
  }
  return obj
}

async function executeTask (task: LdpTask, resource: Blob): Promise<LdpResponse> {
  let result = {
  } as any
  if (!resource.exists()) {
    result.resultType = ResultType.NotFound
    return result
  }
  result.resourceData = await fromStream(await resource.getData())
  debug('result.resourceData set to ', result.resourceData)
  if (task.omitBody) {
    result.resultType = ResultType.OkayWithoutBody
  } else if (task.ifNoneMatch && task.ifNoneMatch.indexOf(result.resourceData.etag) !== -1) {
    result.resultType = ResultType.NotModified
  } else {
    result.resultType = ResultType.OkayWithBody
  }
  return result as LdpResponse
}

export async function readBlob (task: LdpTask, storage: BlobTree): Promise<LdpResponse> {
  debug('operation readBlob!')
  const resource = storage.getBlob(task.path)
  const result = await this.executeTask(task, resource)
  return result
}