/**
 * Traverses HTML5 FileSystemEntry recursively, handling Chrome's 100-entries batch limit
 */
export const traverseFileTree = async (entry: any): Promise<File[]> => {
  const res: File[] = []

  const internalProcess = async (item: any, currentPath: string) => {
    await new Promise<void>((resolve, reject) => {
      const errorCallback = (e: any) => {
        console.error('Directory traverse error:', e)
        reject(e)
      }

      if (item.isFile) {
        item.file(
          (file: File) => {
            const relativePath = currentPath + file.name
            // Attach relative path as custom property or create wrapper
            Object.defineProperty(file, 'customRelativePath', {
              value: relativePath,
              writable: true,
            })
            res.push(file)
            resolve()
          },
          errorCallback
        )
      } else if (item.isDirectory) {
        const dirReader = item.createReader()
        const readEntries = () => {
          dirReader.readEntries(async (entries: any[]) => {
            if (entries.length > 0) {
              for (let i = 0; i < entries.length; i++) {
                await internalProcess(entries[i], currentPath + item.name + '/')
              }
              // Repeatedly read entries until empty array to exceed 100-entry limit
              readEntries()
            } else {
              resolve()
            }
          }, errorCallback)
        }
        readEntries()
      } else {
        resolve()
      }
    })
  }

  await internalProcess(entry, '')
  return res
}

/**
 * Extracts dropped files and directories from DataTransferItemList
 */
export const extractDroppedFiles = async (dataTransfer: DataTransfer): Promise<File[]> => {
  const files: File[] = []
  const items = Array.from(dataTransfer.items || [])
  const rawFiles = Array.from(dataTransfer.files || [])

  if (items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
    const folderEntries: any[] = []

    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry()
      if (entry?.isFile) {
        const file = rawFiles[i] || (items[i].getAsFile && items[i].getAsFile())
        if (file) files.push(file)
      } else if (entry?.isDirectory) {
        folderEntries.push(entry)
      }
    }

    for (const entry of folderEntries) {
      const folderFiles = await traverseFileTree(entry)
      files.push(...folderFiles)
    }
  } else {
    files.push(...rawFiles)
  }

  return files
}

export const getFileRelativePath = (file: File): string => {
  return (
    (file as any).customRelativePath ||
    file.webkitRelativePath ||
    file.name
  )
}
