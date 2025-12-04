import { access, mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Delivery, DeliveryStatus, User, UserRole } from "../../types/models";
import { systemEvents } from "./eventEmitter";
import { getDistanceFromAddresses } from "../../utils/distanceCalculator";

async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const cleanAddress = address.replace(/\s*\([^)]*\)\s*/g, '').trim();
    
    const encodedAddress = encodeURIComponent(cleanAddress);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DeliveryApp/1.0'
      }
    });
    
    if (!response.ok) {
      console.log('Geocoding API request failed', { status: response.status });
      return null;
    }
    
    const data = await response.json() as { lat: string; lon: string }[];
    
    if (data.length === 0) {
      console.log('No geocoding results for address', cleanAddress);
      return null;
    }
    
    const result = data[0];
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      console.log('Invalid coordinates from geocoding', { lat: result.lat, lon: result.lon });
      return null;
    }
    
    console.log('Geocoding successful', { address: cleanAddress, latitude, longitude });
    return { latitude, longitude };
  } catch (error) {
    console.log('Geocoding error', error);
    return null;
  }
}

function appendCoordinatesToAddress(address: string, coords: { latitude: number; longitude: number } | null): string {
  if (!coords) {
    return address;
  }
  
  const cleanAddress = address.replace(/\s*\([^)]*\)\s*/g, '').trim();
  return `${cleanAddress} (${coords.latitude}, ${coords.longitude})`;
}

const DATA_DIR = path.join(process.cwd(), "backend", "data");
const DATA_FILE_PATH = path.join(DATA_DIR, "store.json");
const BACKUP_FILE_PATH = path.join(DATA_DIR, "store.backup.json");
const TEMP_PASSWORD = "1234";

const DEFAULT_USERS: User[] = [
  {
    id: "manager-root",
    name: "מנהל ראשי",
    phone: "+972500000000",
    password: TEMP_PASSWORD,
    role: "manager",
    email: "admin@droppi.co.il",
  },
  {
    id: "manager-operations",
    name: "תמיכה מנהלתית",
    phone: "+972500000009",
    password: "5678",
    role: "manager",
    email: "operations@droppi.co.il",
  },
  {
    id: "manager-central",
    name: "מנהלת סניף מרכז",
    phone: "+972500000123",
    password: "2468",
    role: "manager",
    email: "central@droppi.co.il",
  },
  {
    id: "courier-default",
    name: "דניאל כהן",
    phone: "+972500000200",
    password: TEMP_PASSWORD,
    role: "courier",
    email: "courier@droppi.co.il",
    courierProfile: {
      age: 28,
      email: "courier@droppi.co.il",
      vehicle: "אופנוע",
      isAvailable: false,
    },
  },
];

const PHONE_MIN_DIGITS = 9;

type DataStore = {
  users: User[];
  deliveries: Delivery[];
};

type GlobalWithStore = typeof globalThis & {
  __deliveryDataStore?: DataStore;
  __deliveryDataStoreSignature?: string;
};

let cache: DataStore | null = null;
let pending: Promise<DataStore> | null = null;
let lastPersistedSignature: string | null = null;

const defaultData: DataStore = {
  users: [...DEFAULT_USERS],
  deliveries: [],
};

const cloneData = (data: DataStore): DataStore => JSON.parse(JSON.stringify(data)) as DataStore;

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return entries.reduce<Record<string, unknown>>((accumulator, [key, val]) => {
      accumulator[key] = sortValue(val);
      return accumulator;
    }, {});
  }
  return value;
};

const createDataSignature = (data: DataStore): string => {
  const serialized = JSON.stringify(sortValue(data));
  return serialized ?? "";
};

const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const getErrorCode = (error: unknown): string | undefined => {
  if (error && typeof error === "object" && "code" in error) {
    const candidate = (error as { code?: unknown }).code;
    if (typeof candidate === "string") {
      return candidate;
    }
  }
  return undefined;
};

const createTempFilePath = (): string => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 1000000)}`;
  return path.join(DATA_DIR, `store-${suffix}.tmp`);
};

const parseDataStore = (raw: string): DataStore | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<DataStore>;
    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.deliveries)) {
      return null;
    }
    return {
      users: parsed.users as User[],
      deliveries: parsed.deliveries as Delivery[],
    };
  } catch (error) {
    console.log("Persistent data JSON parse error", error);
    return null;
  }
};

const readDataFile = async (filePath: string, label: string): Promise<DataStore | null> => {
  try {
    const raw = await readFile(filePath, "utf-8");
    if (!raw) {
      console.log(`${label} persistent data file empty`, filePath);
      return null;
    }
    const parsed = parseDataStore(raw);
    if (!parsed) {
      console.log(`${label} persistent data invalid`, filePath);
      return null;
    }
    return parsed;
  } catch (error) {
    const code = getErrorCode(error);
    if (code === "ENOENT") {
      console.log(`${label} persistent data file missing`, filePath);
      return null;
    }
    if (code === "EEXIST") {
      return null;
    }
    console.log(`${label} persistent data read failed`, error);
    return null;
  }
};

const writeAtomicPayload = async (payload: string) => {
  let tempPath: string | null = null;
  try {
    tempPath = createTempFilePath();
    await writeFile(tempPath, payload, { encoding: "utf-8" });
    await rm(BACKUP_FILE_PATH, { force: true });
    try {
      await rename(DATA_FILE_PATH, BACKUP_FILE_PATH);
    } catch (error) {
      if (getErrorCode(error) !== "ENOENT") {
        throw error;
      }
    }
    await rename(tempPath, DATA_FILE_PATH);
  } catch (error) {
    if (tempPath) {
      try {
        await rm(tempPath, { force: true });
      } catch (cleanupError) {
        console.log("Persistent temp file cleanup failed", cleanupError);
      }
    }
    try {
      await rename(BACKUP_FILE_PATH, DATA_FILE_PATH);
    } catch (restoreError) {
      const code = getErrorCode(restoreError);
      if (code && code !== "ENOENT") {
        console.log("Persistent data restore attempt failed", restoreError);
      }
    }
    throw error;
  }
};

const restorePrimaryFromBackup = async (data: DataStore) => {
  let tempPath: string | null = null;
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const payload = JSON.stringify(data, null, 2);
    tempPath = createTempFilePath();
    await writeFile(tempPath, payload, { encoding: "utf-8" });
    await rm(DATA_FILE_PATH, { force: true });
    await rename(tempPath, DATA_FILE_PATH);
  } catch (error) {
    if (tempPath) {
      try {
        await rm(tempPath, { force: true });
      } catch (cleanupError) {
        console.log("Persistent data backup restore cleanup failed", cleanupError);
      }
    }
    console.log("Persistent data restore from backup failed", error);
  }
};

const readPersistedData = async (): Promise<DataStore | null> => {
  const primary = await readDataFile(DATA_FILE_PATH, "Primary");
  if (primary) {
    console.log("Persistent data loaded", {
      users: primary.users.length,
      deliveries: primary.deliveries.length,
    });
    return primary;
  }
  const backup = await readDataFile(BACKUP_FILE_PATH, "Backup");
  if (backup) {
    console.log("Persistent data recovered from backup", {
      users: backup.users.length,
      deliveries: backup.deliveries.length,
    });
    await restorePrimaryFromBackup(backup);
    return backup;
  }
  return null;
};

const writePersistedData = async (data: DataStore) => {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const payload = JSON.stringify(data, null, 2);
    await writeAtomicPayload(payload);
    console.log("Persistent data saved", {
      users: data.users.length,
      deliveries: data.deliveries.length,
    });
  } catch (error) {
    console.log("Persistent data write failed", error);
  }
};

const countDigits = (value: string): number => value.replace(/\D/g, "").length;

const normalizePhoneNumber = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  const normalized = hasLeadingPlus ? `+${digits}` : digits;
  return normalized;
};

const createPhoneComparisonKey = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  if (digits.startsWith("972") && digits.length >= 11) {
    const rest = digits.slice(3);
    if (rest.startsWith("0")) {
      return rest.slice(1);
    }
    return rest;
  }
  if (digits.startsWith("0") && digits.length >= PHONE_MIN_DIGITS) {
    return digits.slice(1);
  }
  return digits;
};

const isValidNormalizedPhone = (phone: string): boolean => {
  return countDigits(phone) >= PHONE_MIN_DIGITS;
};

const normalizeAndDedupeUsers = (users: User[]): { normalized: User[]; changed: boolean } => {
  const seen = new Set<string>();
  let hasChanges = false;

  const normalized = users.reduce<User[]>((accumulator, candidate) => {
    const normalizedPhone = normalizePhoneNumber(candidate.phone);
    const comparisonKey = createPhoneComparisonKey(normalizedPhone || candidate.phone);
    const uniqueKey = comparisonKey || normalizedPhone || candidate.phone;

    if (!normalizedPhone) {
      const trimmedPhone = candidate.phone.trim();
      if (trimmedPhone !== candidate.phone) {
        hasChanges = true;
        accumulator.push({ ...candidate, phone: trimmedPhone });
      } else {
        accumulator.push(candidate);
      }
      return accumulator;
    }

    if (!isValidNormalizedPhone(normalizedPhone)) {
      hasChanges = true;
      accumulator.push({ ...candidate, phone: normalizedPhone });
      return accumulator;
    }

    if (uniqueKey && seen.has(uniqueKey)) {
      hasChanges = true;
      return accumulator;
    }

    if (uniqueKey) {
      seen.add(uniqueKey);
    }

    if (candidate.phone === normalizedPhone) {
      accumulator.push(candidate);
      return accumulator;
    }

    hasChanges = true;
    accumulator.push({ ...candidate, phone: normalizedPhone });
    return accumulator;
  }, []);

  return { normalized, changed: hasChanges };
};

const ensureSeedUsers = (users: User[], isFirstInit: boolean): { normalized: User[]; changed: boolean } => {
  let mutated = [...users];
  let hasChanges = false;

  if (isFirstInit) {
    DEFAULT_USERS.forEach((seed) => {
      const seedKey = createPhoneComparisonKey(seed.phone);
      const exists = mutated.some((candidate) => createPhoneComparisonKey(candidate.phone) === seedKey);
      if (!exists) {
        mutated = [seed, ...mutated];
        hasChanges = true;
      }
    });
  }

  if (!mutated.some((candidate) => candidate.role === "manager")) {
    mutated = [DEFAULT_USERS[0], ...mutated];
    hasChanges = true;
  }

  return { normalized: mutated, changed: hasChanges };
};

const resolveGlobalStore = (isFirstInit: boolean): DataStore => {
  const globalTarget = globalThis as GlobalWithStore;
  if (!globalTarget.__deliveryDataStore) {
    const { normalized: dedupedUsers } = normalizeAndDedupeUsers(defaultData.users);
    const { normalized: seededUsers } = ensureSeedUsers(dedupedUsers, isFirstInit);
    globalTarget.__deliveryDataStore = {
      users: seededUsers,
      deliveries: [...defaultData.deliveries],
    };
  }
  const signature = createDataSignature(globalTarget.__deliveryDataStore);
  globalTarget.__deliveryDataStoreSignature = signature;
  if (!lastPersistedSignature) {
    lastPersistedSignature = signature;
  }
  return globalTarget.__deliveryDataStore;
};

const loadData = async (): Promise<DataStore> => {
  if (cache) {
    console.log("[LOAD DATA] Returning cached data:", cache.users.length, "users");
    return cache;
  }
  if (pending) {
    console.log("[LOAD DATA] Awaiting existing load operation");
    return pending;
  }

  pending = (async () => {
    console.log("[LOAD DATA] Starting data load operation");
    const persisted = await readPersistedData();
    const isFirstInit = !persisted;
    
    if (persisted) {
      const persistedSignature = createDataSignature(persisted);
      lastPersistedSignature = persistedSignature;
      const globalTarget = globalThis as GlobalWithStore;
      globalTarget.__deliveryDataStore = persisted;
      globalTarget.__deliveryDataStoreSignature = persistedSignature;
      console.log("[LOAD DATA] Loaded from file:", persisted.users.length, "users");
      
      const { normalized: dedupedUsers, changed: dedupeChanged } = normalizeAndDedupeUsers(persisted.users);
      const { normalized: seededUsers, changed: seedChanged } = ensureSeedUsers(dedupedUsers, isFirstInit);
      
      const normalizedData: DataStore = {
        users: seededUsers,
        deliveries: persisted.deliveries,
      };
      
      cache = normalizedData;
      globalTarget.__deliveryDataStore = normalizedData;
      globalTarget.__deliveryDataStoreSignature = createDataSignature(normalizedData);
      
      if (dedupeChanged || seedChanged) {
        console.log("[LOAD DATA] Data normalized, writing to file");
        await writePersistedData(normalizedData);
        lastPersistedSignature = createDataSignature(normalizedData);
      }
      
      pending = null;
      console.log("[LOAD DATA] Completed with persisted data.");
      return cache;
    }
    
    console.log("[LOAD DATA] No file found, using defaults");
    const base = cloneData(resolveGlobalStore(isFirstInit));
    const { normalized: dedupedUsers, changed: dedupeChanged } = normalizeAndDedupeUsers(base.users);
    const { normalized: seededUsers, changed: seedChanged } = ensureSeedUsers(dedupedUsers, isFirstInit);
    
    const normalizedData: DataStore = {
      users: seededUsers,
      deliveries: base.deliveries,
    };
    
    cache = normalizedData;
    const globalTarget = globalThis as GlobalWithStore;
    globalTarget.__deliveryDataStore = normalizedData;
    globalTarget.__deliveryDataStoreSignature = createDataSignature(normalizedData);
    
    console.log("[LOAD DATA] Writing initial data to file");
    await writePersistedData(normalizedData);
    lastPersistedSignature = createDataSignature(normalizedData);
    
    pending = null;
    console.log("[LOAD DATA] Completed with default data.");
    return cache;
  })();

  return pending;
};

const persistData = async (next: DataStore, skipWrite = false) => {
  const cloned = cloneData(next);
  const signature = createDataSignature(cloned);
  
  console.log("[PERSIST] Operation started. Users:", cloned.users.length, "skipWrite:", skipWrite);
  
  cache = cloned;
  
  const globalTarget = globalThis as GlobalWithStore;
  globalTarget.__deliveryDataStore = cloned;
  globalTarget.__deliveryDataStoreSignature = signature;
  
  if (skipWrite) {
    const persistedExists = await fileExists(DATA_FILE_PATH);
    if (!persistedExists || lastPersistedSignature !== signature) {
      console.log("[PERSIST] Writing (skipWrite but conditions require it)");
      await writePersistedData(cloned);
      lastPersistedSignature = signature;
      return;
    }
    console.log("[PERSIST] Skipped write - no changes");
    lastPersistedSignature = signature;
    return;
  }
  
  console.log("[PERSIST] Force writing", cloned.users.length, "users to file");
  await writePersistedData(cloned);
  lastPersistedSignature = signature;
  console.log("[PERSIST] Write completed successfully");
};

const generateId = () => `${Date.now()}-${Math.round(Math.random() * 100000)}`;

const getUserById = (users: User[], userId: string): User | undefined => {
  return users.find((candidate) => candidate.id === userId);
};

const roleErrorMessages: Record<UserRole, string> = {
  manager: "גישה מותרת רק למנהלים מחוברים",
  business: "הפעולה זמינה רק לחשבונות עסק",
  courier: "גישה מותרת רק לשליחים",
};

const assertRole = (user: User | undefined, role: UserRole, context: string) => {
  if (!user) {
    console.log("Role assertion failed - missing user", { context, role });
    throw new Error("החשבון המבצע לא נמצא. התנתקו והתחברו מחדש.");
  }
  if (user.role !== role) {
    console.log("Role assertion failed - mismatched role", { context, expectedRole: role, actualRole: user.role });
    throw new Error(roleErrorMessages[role]);
  }
};

const ensureManagerAccess = (users: User[], managerId: string, context: string): User => {
  const candidate = getUserById(users, managerId);
  if (candidate && candidate.role === "manager") {
    return candidate;
  }
  const fallbackManager = users.find((user) => user.role === "manager");
  if (fallbackManager) {
    console.log("Manager fallback applied", {
      context,
      requestedManagerId: managerId,
      fallbackManagerId: fallbackManager.id,
    });
    return fallbackManager;
  }
  console.log("Manager access failed - no managers available", { context, managerId });
  throw new Error("לא נמצא מנהל פעיל במערכת. פנו לתמיכה להקמת חשבון מנהל.");
};

export const deliveryStore = {
  async getUsers(): Promise<User[]> {
    const data = await loadData();
    return data.users.map((user) => {
      if (user.role === "courier" && user.courierProfile && user.courierProfile.isAvailable === undefined) {
        return {
          ...user,
          courierProfile: {
            ...user.courierProfile,
            isAvailable: false,
          },
        };
      }
      return user;
    });
  },

  async getDeliveries(): Promise<Delivery[]> {
    const data = await loadData();
    return data.deliveries;
  },

  async login(phone: string, password: string): Promise<User> {
    const normalizedPhone = normalizePhoneNumber(phone);
    const comparisonKey = createPhoneComparisonKey(normalizedPhone || phone);
    if (!normalizedPhone || !isValidNormalizedPhone(normalizedPhone)) {
      throw new Error("מספר הטלפון שהוזן אינו תקין");
    }
    const data = await loadData();
    const foundUser = data.users.find((candidate) => {
      const candidateNormalized = normalizePhoneNumber(candidate.phone);
      const candidateKey = createPhoneComparisonKey(candidateNormalized || candidate.phone);
      const phonesMatch =
        (!!candidateNormalized && candidateNormalized === normalizedPhone) ||
        (!!candidateKey && !!comparisonKey && candidateKey === comparisonKey);
      return phonesMatch && candidate.password === password;
    });
    if (!foundUser) {
      throw new Error("פרטי הכניסה שגויים");
    }
    if (foundUser.role === "courier" && foundUser.courierProfile && foundUser.courierProfile.isAvailable === undefined) {
      return {
        ...foundUser,
        courierProfile: {
          ...foundUser.courierProfile,
          isAvailable: false,
        },
      };
    }
    return foundUser;
  },

  async registerCourier(payload: {
    managerId: string;
    name: string;
    age: number;
    phone: string;
    email: string;
    vehicle: string;
    password: string;
  }): Promise<User> {
    console.log("[REGISTER COURIER] Starting registration", payload.phone);
    const data = await loadData();
    const manager = ensureManagerAccess(data.users, payload.managerId, "registerCourier");
    console.log("[REGISTER COURIER] Manager validated", { managerId: manager.id });

    const normalizedPhone = normalizePhoneNumber(payload.phone);
    const comparisonKey = createPhoneComparisonKey(normalizedPhone || payload.phone);

    if (!payload.name.trim() || !normalizedPhone || !payload.email.trim() || !payload.vehicle.trim()) {
      throw new Error("יש למלא את כל השדות");
    }
    if (!isValidNormalizedPhone(normalizedPhone)) {
      throw new Error("מספר הטלפון שהוזן אינו תקין");
    }
    if (!Number.isInteger(payload.age) || payload.age < 18) {
      throw new Error("גיל השליח חייב להיות 18 ומעלה");
    }
    if (payload.password.trim().length < 4) {
      throw new Error("הסיסמה חייבת להכיל לפחות 4 תווים");
    }

    const exists = data.users.some((candidate) => {
      const candidateKey = createPhoneComparisonKey(candidate.phone);
      return !!candidateKey && candidateKey === comparisonKey;
    });
    if (exists) {
      throw new Error("מספר הטלפון כבר רשום במערכת");
    }

    const created: User = {
      id: `courier-${generateId()}`,
      name: payload.name.trim(),
      phone: normalizedPhone,
      password: payload.password.trim(),
      role: "courier",
      email: payload.email.trim().toLowerCase(),
      courierProfile: {
        age: payload.age,
        email: payload.email.trim().toLowerCase(),
        vehicle: payload.vehicle.trim(),
        isAvailable: false,
      },
    };
    console.log("[REGISTER COURIER] User object created", created.id);

    const nextUsers = [...data.users, created];
    const { normalized: dedupedUsers } = normalizeAndDedupeUsers(nextUsers);
    const { normalized: seededUsers } = ensureSeedUsers(dedupedUsers, false);

    const nextData: DataStore = {
      users: seededUsers,
      deliveries: data.deliveries,
    };

    console.log("[REGISTER COURIER] About to persist data. Users before:", data.users.length, "Users after:", nextData.users.length);
    console.log("[REGISTER COURIER] Calling persistData with skipWrite=false");
    await persistData(nextData, false);
    console.log("[REGISTER COURIER] Persist completed", created.id, "Total users:", nextData.users.length);
    console.log("[REGISTER COURIER] File path:", DATA_FILE_PATH);
    console.log("[REGISTER COURIER] Verifying cache:", cache?.users.length, "users");
    
    try {
      const verifyContent = await readFile(DATA_FILE_PATH, "utf-8");
      const verifyParsed = JSON.parse(verifyContent) as DataStore;
      console.log("[REGISTER COURIER] File verification - users in file:", verifyParsed.users.length);
      const newUserInFile = verifyParsed.users.find(u => u.id === created.id);
      console.log("[REGISTER COURIER] New user in file?", !!newUserInFile, newUserInFile?.name);
    } catch (verifyError) {
      console.log("[REGISTER COURIER] File verification failed:", verifyError);
    }
    
    systemEvents.emitUserCreated(created);
    return created;
  },

  async registerBusiness(payload: {
    managerId: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    password: string;
  }): Promise<User> {
    console.log("[REGISTER BUSINESS] Starting registration", payload.phone);
    const data = await loadData();
    const manager = ensureManagerAccess(data.users, payload.managerId, "registerBusiness");
    console.log("[REGISTER BUSINESS] Manager validated", { managerId: manager.id });

    const normalizedPhone = normalizePhoneNumber(payload.phone);
    const comparisonKey = createPhoneComparisonKey(normalizedPhone || payload.phone);

    if (!payload.name.trim() || !payload.address.trim() || !normalizedPhone || !payload.email.trim()) {
      throw new Error("יש למלא את כל השדות");
    }
    if (!isValidNormalizedPhone(normalizedPhone)) {
      throw new Error("מספר הטלפון שהוזן אינו תקין");
    }
    if (payload.password.trim().length < 4) {
      throw new Error("הסיסמה חייבת להכיל לפחות 4 תווים");
    }

    const exists = data.users.some((candidate) => {
      const candidateKey = createPhoneComparisonKey(candidate.phone);
      return !!candidateKey && candidateKey === comparisonKey;
    });
    if (exists) {
      throw new Error("מספר הטלפון כבר רשום במערכת");
    }

    const created: User = {
      id: `business-${generateId()}`,
      name: payload.name.trim(),
      phone: normalizedPhone,
      password: payload.password.trim(),
      role: "business",
      email: payload.email.trim().toLowerCase(),
      businessProfile: {
        address: payload.address.trim(),
        email: payload.email.trim().toLowerCase(),
      },
    };
    console.log("[REGISTER BUSINESS] User object created", created.id);

    const nextUsers = [...data.users, created];
    const { normalized: dedupedUsers } = normalizeAndDedupeUsers(nextUsers);
    const { normalized: seededUsers } = ensureSeedUsers(dedupedUsers, false);

    const nextData: DataStore = {
      users: seededUsers,
      deliveries: data.deliveries,
    };

    console.log("[REGISTER BUSINESS] About to persist data. Users before:", data.users.length, "Users after:", nextData.users.length);
    console.log("[REGISTER BUSINESS] Calling persistData with skipWrite=false");
    await persistData(nextData, false);
    console.log("[REGISTER BUSINESS] Persist completed", created.id, "Total users:", nextData.users.length);
    console.log("[REGISTER BUSINESS] File path:", DATA_FILE_PATH);
    console.log("[REGISTER BUSINESS] Verifying cache:", cache?.users.length, "users");
    
    try {
      const verifyContent = await readFile(DATA_FILE_PATH, "utf-8");
      const verifyParsed = JSON.parse(verifyContent) as DataStore;
      console.log("[REGISTER BUSINESS] File verification - users in file:", verifyParsed.users.length);
      const newUserInFile = verifyParsed.users.find(u => u.id === created.id);
      console.log("[REGISTER BUSINESS] New user in file?", !!newUserInFile, newUserInFile?.name);
    } catch (verifyError) {
      console.log("[REGISTER BUSINESS] File verification failed:", verifyError);
    }
    
    systemEvents.emitUserCreated(created);
    return created;
  },

  async registerManager(payload: {
    managerId: string;
    name: string;
    phone: string;
    email: string;
    password: string;
  }): Promise<User> {
    console.log("[REGISTER MANAGER] Starting registration", payload.phone);
    const data = await loadData();
    const manager = ensureManagerAccess(data.users, payload.managerId, "registerManager");
    console.log("[REGISTER MANAGER] Manager validated", { managerId: manager.id });

    const normalizedPhone = normalizePhoneNumber(payload.phone);
    const comparisonKey = createPhoneComparisonKey(normalizedPhone || payload.phone);

    if (!payload.name.trim() || !normalizedPhone || !payload.email.trim()) {
      throw new Error("יש למלא את כל השדות");
    }
    if (!isValidNormalizedPhone(normalizedPhone)) {
      throw new Error("מספר הטלפון שהוזן אינו תקין");
    }
    if (payload.password.trim().length < 4) {
      throw new Error("הסיסמה חייבת להכיל לפחות 4 תווים");
    }

    const exists = data.users.some((candidate) => {
      const candidateKey = createPhoneComparisonKey(candidate.phone);
      return !!candidateKey && candidateKey === comparisonKey;
    });
    if (exists) {
      throw new Error("מספר הטלפון כבר רשום במערכת");
    }

    const created: User = {
      id: `manager-${generateId()}`,
      name: payload.name.trim(),
      phone: normalizedPhone,
      password: payload.password.trim(),
      role: "manager",
      email: payload.email.trim().toLowerCase(),
    };
    console.log("[REGISTER MANAGER] User object created", created.id);

    const nextUsers = [...data.users, created];
    const { normalized: dedupedUsers } = normalizeAndDedupeUsers(nextUsers);
    const { normalized: seededUsers } = ensureSeedUsers(dedupedUsers, false);

    const nextData: DataStore = {
      users: seededUsers,
      deliveries: data.deliveries,
    };

    console.log("[REGISTER MANAGER] About to persist data. Users before:", data.users.length, "Users after:", nextData.users.length);
    console.log("[REGISTER MANAGER] Calling persistData with skipWrite=false");
    await persistData(nextData, false);
    console.log("[REGISTER MANAGER] Persist completed", created.id, "Total users:", nextData.users.length);
    console.log("[REGISTER MANAGER] File path:", DATA_FILE_PATH);
    console.log("[REGISTER MANAGER] Verifying cache:", cache?.users.length, "users");
    
    try {
      const verifyContent = await readFile(DATA_FILE_PATH, "utf-8");
      const verifyParsed = JSON.parse(verifyContent) as DataStore;
      console.log("[REGISTER MANAGER] File verification - users in file:", verifyParsed.users.length);
      const newUserInFile = verifyParsed.users.find(u => u.id === created.id);
      console.log("[REGISTER MANAGER] New user in file?", !!newUserInFile, newUserInFile?.name);
    } catch (verifyError) {
      console.log("[REGISTER MANAGER] File verification failed:", verifyError);
    }
    
    systemEvents.emitUserCreated(created);
    return created;
  },

  async createDelivery(payload: {
    businessId: string;
    pickupAddress: string;
    dropoffAddress: string;
    notes: string;
    customerName: string;
    customerPhone: string;
    preparationTimeMinutes: number;
  }): Promise<Delivery> {
    const data = await loadData();
    const business = getUserById(data.users, payload.businessId);
    assertRole(business, "business", "createDelivery");

    if (!payload.pickupAddress.trim() || !payload.dropoffAddress.trim() || !payload.customerName.trim() || !payload.customerPhone.trim()) {
      throw new Error("יש למלא את כל השדות");
    }

    let pickupAddressWithCoords = payload.pickupAddress.trim();
    let dropoffAddressWithCoords = payload.dropoffAddress.trim();

    const [pickupCoords, dropoffCoords] = await Promise.all([
      geocodeAddress(pickupAddressWithCoords),
      geocodeAddress(dropoffAddressWithCoords)
    ]);

    pickupAddressWithCoords = appendCoordinatesToAddress(pickupAddressWithCoords, pickupCoords);
    dropoffAddressWithCoords = appendCoordinatesToAddress(dropoffAddressWithCoords, dropoffCoords);

    const distanceKm = getDistanceFromAddresses(pickupAddressWithCoords, dropoffAddressWithCoords);
    
    if (distanceKm !== null) {
      console.log("Distance calculated for new delivery:", distanceKm, "km");
    } else {
      console.log("Could not calculate distance - addresses may not have coordinates");
    }

    const created: Delivery = {
      id: `delivery-${generateId()}`,
      businessId: payload.businessId,
      courierId: null,
      pickupAddress: pickupAddressWithCoords,
      dropoffAddress: dropoffAddressWithCoords,
      notes: payload.notes.trim(),
      status: "waiting",
      createdAt: new Date().toISOString(),
      preparationTimeMinutes: payload.preparationTimeMinutes,
      customerName: payload.customerName.trim(),
      customerPhone: payload.customerPhone.trim(),
      payment: 25,
      distanceKm: distanceKm ?? undefined,
    };

    const nextData: DataStore = {
      users: data.users,
      deliveries: [created, ...data.deliveries],
    };

    await persistData(nextData);
    systemEvents.emitDeliveryCreated(created);
    return created;
  },

  async managerUpdateDelivery(payload: {
    managerId: string;
    deliveryId: string;
    status?: DeliveryStatus;
    courierId?: string | null;
  }): Promise<Delivery> {
    const data = await loadData();
    const manager = ensureManagerAccess(data.users, payload.managerId, "managerUpdateDelivery");
    console.log("Manager validated for delivery update", { managerId: manager.id, deliveryId: payload.deliveryId });

    const current = data.deliveries.find((delivery) => delivery.id === payload.deliveryId);
    if (!current) {
      throw new Error("המשלוח לא נמצא");
    }

    const nextStatus: DeliveryStatus = payload.status ?? current.status;
    const resolvedCourierId = typeof payload.courierId !== "undefined" ? payload.courierId : current.courierId;
    const sanitizedCourierId = nextStatus === "waiting" ? null : resolvedCourierId ?? null;

    if (sanitizedCourierId) {
      const courier = getUserById(data.users, sanitizedCourierId);
      assertRole(courier, "courier", "managerUpdateDelivery.assign");
    }

    const updated: Delivery = {
      ...current,
      status: nextStatus,
      courierId: sanitizedCourierId,
    };

    const nextData: DataStore = {
      users: data.users,
      deliveries: data.deliveries.map((delivery) => (delivery.id === updated.id ? updated : delivery)),
    };

    await persistData(nextData);
    systemEvents.emitDeliveryUpdated(updated);
    return updated;
  },

  async courierTakeDelivery(payload: { courierId: string; deliveryId: string; estimatedArrivalMinutes: number }): Promise<Delivery> {
    const data = await loadData();
    const courier = getUserById(data.users, payload.courierId);
    assertRole(courier, "courier", "courierTakeDelivery");

    const current = data.deliveries.find((delivery) => delivery.id === payload.deliveryId);
    if (!current) {
      throw new Error("המשלוח לא נמצא");
    }
    if (current.status !== "waiting") {
      throw new Error("משלוח זה כבר נלקח");
    }

    const updated: Delivery = {
      ...current,
      status: "taken",
      courierId: payload.courierId,
      estimatedArrivalMinutes: payload.estimatedArrivalMinutes,
      payment: current.payment ?? 25,
    };

    const nextData: DataStore = {
      users: data.users,
      deliveries: data.deliveries.map((delivery) => (delivery.id === updated.id ? updated : delivery)),
    };

    await persistData(nextData);
    systemEvents.emitDeliveryAssigned(updated);
    return updated;
  },

  async courierPickupDelivery(payload: { courierId: string; deliveryId: string }): Promise<Delivery> {
    const data = await loadData();
    const courier = getUserById(data.users, payload.courierId);
    assertRole(courier, "courier", "courierPickupDelivery");

    const current = data.deliveries.find((delivery) => delivery.id === payload.deliveryId);
    if (!current) {
      throw new Error("המשלוח לא נמצא");
    }
    if (current.courierId !== payload.courierId) {
      throw new Error("אין לך הרשאה לאסוף משלוח זה");
    }
    if (current.status !== "taken") {
      throw new Error("ניתן לאסוף רק משלוחים שנלקחו על ידי שליח");
    }
    if (!current.businessReady) {
      throw new Error("ההזמנה עדיין לא מוכנה לאיסוף");
    }

    const updated: Delivery = {
      ...current,
      pickedUpAt: new Date().toISOString(),
    };

    const nextData: DataStore = {
      users: data.users,
      deliveries: data.deliveries.map((delivery) => (delivery.id === updated.id ? updated : delivery)),
    };

    await persistData(nextData);
    console.log("Courier picked up delivery", { courierId: payload.courierId, deliveryId: payload.deliveryId });
    return updated;
  },

  async courierCompleteDelivery(payload: { courierId: string; deliveryId: string }): Promise<Delivery> {
    const data = await loadData();
    const courier = getUserById(data.users, payload.courierId);
    assertRole(courier, "courier", "courierCompleteDelivery");

    const current = data.deliveries.find((delivery) => delivery.id === payload.deliveryId);
    if (!current) {
      throw new Error("המשלוח לא נמצא");
    }
    if (current.courierId !== payload.courierId) {
      throw new Error("אין לך הרשאה להשלמת משלוח זה");
    }
    if (!current.pickedUpAt) {
      throw new Error("יש לאסוף את המשלוח מהמסעדה תחילה");
    }

    const updated: Delivery = {
      ...current,
      status: "completed",
      completedAt: new Date().toISOString(),
      businessReady: false,
      businessConfirmed: false,
    };

    const nextData: DataStore = {
      users: data.users,
      deliveries: data.deliveries.map((delivery) => (delivery.id === updated.id ? updated : delivery)),
    };

    await persistData(nextData);
    console.log("Delivery completed and ready status reset", { courierId: payload.courierId, deliveryId: payload.deliveryId });
    systemEvents.emitDeliveryCompleted(updated);
    return updated;
  },

  async courierUpdateAvailability(payload: { courierId: string; isAvailable: boolean }): Promise<User> {
    const data = await loadData();
    const courier = getUserById(data.users, payload.courierId);
    assertRole(courier, "courier", "courierUpdateAvailability");

    if (!courier) {
      throw new Error("שליח לא נמצא");
    }

    if (!courier.courierProfile) {
      throw new Error("פרופיל שליח לא נמצא");
    }

    const updatedCourier: User = {
      ...courier,
      courierProfile: {
        ...courier.courierProfile,
        isAvailable: payload.isAvailable,
      },
    };

    const nextData: DataStore = {
      users: data.users.map((user) => (user.id === updatedCourier.id ? updatedCourier : user)),
      deliveries: data.deliveries,
    };

    await persistData(nextData);
    console.log("Courier availability updated", { courierId: payload.courierId, isAvailable: payload.isAvailable });
    systemEvents.emitUserUpdated(updatedCourier);
    return updatedCourier;
  },

  async businessConfirmDelivery(payload: { businessId: string; deliveryId: string }): Promise<Delivery> {
    const data = await loadData();
    const business = getUserById(data.users, payload.businessId);
    assertRole(business, "business", "businessConfirmDelivery");

    const current = data.deliveries.find((delivery) => delivery.id === payload.deliveryId);
    if (!current) {
      throw new Error("המשלוח לא נמצא");
    }
    if (current.businessId !== payload.businessId) {
      throw new Error("אין לך הרשאה לאשר משלוח זה");
    }
    if (current.status !== "taken") {
      throw new Error("ניתן לאשר רק משלוחים שנלקחו על ידי שליח");
    }
    if (!current.estimatedArrivalMinutes) {
      throw new Error("השליח טרם הגדיר זמן הגעה משוער");
    }

    const updated: Delivery = {
      ...current,
      businessConfirmed: true,
      confirmedAt: new Date().toISOString(),
    };

    const nextData: DataStore = {
      users: data.users,
      deliveries: data.deliveries.map((delivery) => (delivery.id === updated.id ? updated : delivery)),
    };

    await persistData(nextData);
    console.log("Business confirmed delivery", { businessId: payload.businessId, deliveryId: payload.deliveryId });
    return updated;
  },

  async businessMarkReady(payload: { businessId: string; deliveryId: string }): Promise<Delivery> {
    const data = await loadData();
    const business = getUserById(data.users, payload.businessId);
    assertRole(business, "business", "businessMarkReady");

    const current = data.deliveries.find((delivery) => delivery.id === payload.deliveryId);
    if (!current) {
      throw new Error("המשלוח לא נמצא");
    }
    if (current.businessId !== payload.businessId) {
      throw new Error("אין לך הרשאה לסמן משלוח זה כמוכן");
    }
    if (current.status !== "taken") {
      throw new Error("ניתן לסמן כמוכן רק משלוחים שנלקחו על ידי שליח");
    }
    if (!current.businessConfirmed) {
      throw new Error("יש לאשר את ההזמנה תחילה");
    }

    const updated: Delivery = {
      ...current,
      businessReady: true,
    };

    const nextData: DataStore = {
      users: data.users,
      deliveries: data.deliveries.map((delivery) => (delivery.id === updated.id ? updated : delivery)),
    };

    await persistData(nextData);
    console.log("Business marked delivery ready", { businessId: payload.businessId, deliveryId: payload.deliveryId });
    systemEvents.emitDeliveryReady(updated);
    return updated;
  },

  async registerPushToken(userId: string, pushToken: string): Promise<User> {
    const data = await loadData();
    const user = getUserById(data.users, userId);
    
    if (!user) {
      throw new Error("משתמש לא נמצא");
    }

    const updatedUser: User = {
      ...user,
      pushToken,
    };

    const nextData: DataStore = {
      users: data.users.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
      deliveries: data.deliveries,
    };

    await persistData(nextData);
    console.log("Push token registered for user", { userId, pushToken: pushToken.substring(0, 20) + "..." });
    return updatedUser;
  },

  async getAvailableCouriersWithTokens(): Promise<User[]> {
    const data = await loadData();
    return data.users.filter(
      (user) =>
        user.role === "courier" &&
        user.courierProfile?.isAvailable === true &&
        user.pushToken
    );
  },

};
