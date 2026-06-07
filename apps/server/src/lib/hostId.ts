import os from 'os'

export const hostId = `${os.hostname()}-${process.pid}`
