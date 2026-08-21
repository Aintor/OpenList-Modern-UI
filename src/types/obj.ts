export enum ObjType {
  UNKNOWN = 0,
  FOLDER = 1,
  VIDEO = 2,
  AUDIO = 3,
  TEXT = 4,
  IMAGE = 5,
}

export interface Obj {
  name: string
  size: number
  is_dir: boolean
  created: string
  modified: string
  sign?: string
  thumb: string
  type: ObjType
  raw_url?: string
  header?: string
  readme?: string
  provider?: string
  mount_details?: MountDetails
}

export type StoreObj = Obj & {
  selected?: boolean
}

export type ArchiveObj = Obj & {
  inner_path?: string
  archive?: Obj
  pass?: string
}

export type RenameObj = {
  src_name: string
  new_name: string
}

export type ObjTree = Obj & {
  children?: ObjTree[]
}

export type ArchiveMeta = {
  content: ObjTree[] | null
  encrypted: boolean
  comment: string
  sort?: {
    order_by: "" | "name" | "size" | "modified"
    order_direction: "" | "asc" | "desc"
    extract_folder: "" | "front" | "back"
  }
  raw_url: string
  sign: string
}

export type MountDetails = {
  total_space?: number
  free_space?: number
  used_space?: number
  driver_name: string
}

export type ArchiveList = {
  content: Obj[]
  total: number
}
