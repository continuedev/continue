import type { CommandSpec } from '../registry'
import alias from './alias'
import nohup from './nohup'
import pyright from './pyright'
import sleep from './sleep'
import srun from './srun'
import time from './time'
import timeout from './timeout'

export default [
  pyright,
  timeout,
  sleep,
  alias,
  nohup,
  time,
  srun,
] satisfies CommandSpec[]
