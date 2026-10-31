import * as Device from 'expo-device';
import { Platform } from 'react-native';

const LOW_MEMORY_BYTES = 3 * 1024 ** 3;
const LOW_YEAR_CLASS = 2019;

/** Android phones with under 3 GiB of RAM, or a device year class before 2019, are treated as low-end. iOS, web and unknown: false. */
export function isLowEndDevice(): boolean {
  if (Platform.OS !== 'android') return false;
  const { totalMemory, deviceYearClass } = Device;
  if (totalMemory !== null && totalMemory < LOW_MEMORY_BYTES) return true;
  return deviceYearClass !== null && deviceYearClass < LOW_YEAR_CLASS;
}
