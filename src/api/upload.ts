import axios from 'axios'
import { isEmpty } from 'lodash'

import { ConfigService } from '../services'
import { TAPE_HOST } from '../services/config.service'
import { bytesToSize } from '../helpers/utils'
import { GraphQLClient } from 'graphql-request'

interface CreateTape {
  url: string
  tapeUrl: string
  id: string
}

interface QlError {
  message: string
  extensions?: {
    code: string
  }
}

const createQlClient = async () => {
  const accessToken = await ConfigService.get('token')

  if (isEmpty(accessToken)) {
    throw new Error('Please login, run: tape login or tape config')
  }

  return new GraphQLClient(`${TAPE_HOST}/.netlify/functions/graphql`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      'auth-provider': 'cli',
    },
  })
}

export const generateSignedUploadURL = async (
  fileName: string,
  contentType: string,
  metadata: object
) => {
  const qlClient = await createQlClient()

  const createTapeMutation = `
    mutation createTape($fileName: String!, $contentType: String, $metadata: TapeMetadataInput) {
      createTape(input: {
        fileName: $fileName
        contentType: $contentType
        metadata: $metadata
      }) {
        id
        url
        tapeUrl
      }
    }
  `

  const variables = { fileName, contentType, metadata }

  try {
    const data: { createTape: CreateTape } = await qlClient.request(
      createTapeMutation,
      variables
    )

    return data.createTape
  } catch (error) {
    if (error?.response?.errors[0]?.extensions.code === 'UNAUTHENTICATED') {
      throw new Error(
        'Authentication error. Try again after running -> tape login '
      )
    }

    if (error?.response?.errors) {
      throw new Error(
        error?.response?.errors.map((error: QlError) => error.message)
      )
    }

    throw error
  }
}

export const confirmTape = async (id: string) => {
  const qlClient = await createQlClient()

  const confirmTapeMutation = `mutation confirmTape($id: String!) {
    confirmTape(
      id: $id
    ) {
      fileSize
    }
  }`

  const variables = { id }

  const data = await qlClient.request(confirmTapeMutation, variables)

  const { fileSize } = data.confirmTape
  console.log(`File Size: ${bytesToSize(fileSize)}`)
}

export const putFile = async (
  file: Buffer,
  signedUrl: string,
  headers: object
) => {
  return axios.put(signedUrl, file, {
    headers,
    maxContentLength: Infinity,
  })
}
