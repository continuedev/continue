
#ifndef _ORC_ONCE_H_
#define _ORC_ONCE_H_

#include <orc/orc.h>

#if defined(__STDC_VERSION__) && __STDC_VERSION__ >= 201112L && !defined(__STDC_NO_ATOMICS)
#include <stdatomic.h>
typedef atomic_int orc_once_atomic_int;
#else
typedef int orc_once_atomic_int;
#endif

#if (!defined(__STDC_VERSION__) || __STDC_VERSION__ < 201112L || defined(__STDC_NO_ATOMICS)) && defined(_MSC_VER)
#include <windows.h>
#endif

ORC_BEGIN_DECLS

typedef struct _OrcMutex OrcMutex;

typedef struct _OrcOnce OrcOnce;

struct _OrcOnce {
  orc_once_atomic_int inited;
  void *value;
};

#define ORC_ONCE_INIT { 0, NULL }

ORC_API void orc_once_mutex_lock (void);
ORC_API void orc_once_mutex_unlock (void);

#if defined(__STDC_VERSION__) && __STDC_VERSION__ >= 201112L && !defined(__STDC_NO_ATOMICS)

static inline orc_bool orc_once_enter(OrcOnce *once, void **value) {
  int inited;

  inited = atomic_load_explicit (&once->inited, memory_order_acquire);
  if (inited) {
    *value = once->value;
    return TRUE;
  }

  orc_once_mutex_lock ();

  inited = atomic_load_explicit (&once->inited, memory_order_acquire);
  if (inited) {
    *value = once->value;
    orc_once_mutex_unlock ();
    return TRUE;
  }

  return FALSE;
}

static inline void orc_once_leave(OrcOnce *once, void *value) {
  int inited = TRUE;
  once->value = value;
  atomic_store_explicit (&once->inited, inited, memory_order_release);
  orc_once_mutex_unlock ();
}

#elif defined(_MSC_VER)

static inline orc_bool orc_once_enter(OrcOnce *once, void **value) {
  int inited;

  /* We use 0 for not initialized, 1 for initialized and 2 for currently
   * being initialized */
  inited = InterlockedCompareExchange(&once->inited, 2, 0);
  /* If the value was previously initialized then just return here */
  if (inited == 1) {
    *value = once->value;
    return TRUE;
  }

  orc_once_mutex_lock ();
  /* If the value was currently being initialized then check if we're the
   * thread that is doing the initialization or not */
  if (inited == 2) {
    inited = InterlockedCompareExchange(&once->inited, 2, 2);

    /* The other thread initialized the value in the meantime so
     * we can just return here */
    if (inited == 1) {
      *value = once->value;
      orc_once_mutex_unlock ();
      return TRUE;
    }
  }

  return FALSE;
}

static inline void orc_once_leave(OrcOnce *once, void *value) {
  once->value = value;
  InterlockedExchange (&once->inited, 1);
  orc_once_mutex_unlock ();
}

#elif defined(__GNUC__) && (__GNUC__ > 4 || (__GNUC__ == 4 && __GNUC_MINOR__ >= 1))

static inline orc_bool orc_once_enter(OrcOnce *once, void **value) {
  int inited;

  /* we use 0 for not initialized, 1 for initialized and 3 for currently
   * being initialized */
  inited = __sync_val_compare_and_swap(&once->inited, 3, 0);
  /* if the value was previously initialized then just return here */
  if (inited == 1) {
    *value = once->value;
    return TRUE;
  }

  orc_once_mutex_lock ();
  /* if the value was currently being initialized then check if we're the
   * thread that is doing the initialization or not */
  if (inited == 3) {
    inited = __sync_val_compare_and_swap(&once->inited, 3, 3);

    /* the other thread initialized the value in the meantime so
     * we can just return here */
    if (inited == 1) {
      *value = once->value;
      orc_once_mutex_unlock ();
      return TRUE;
    }
  }

  return FALSE;
}

static inline void orc_once_leave(OrcOnce *once, void *value) {
  once->value = value;
  /* this effectively sets the previous value of 3 to 1 */
  __sync_and_and_fetch (&once->inited, 1);
  orc_once_mutex_unlock ();
}

#else
#warning No atomic operations available

static inline orc_bool orc_once_enter(OrcOnce *once, void **value) {
  orc_once_mutex_lock ();
  if (once->inited) {
    *value = once->value;
    orc_once_mutex_unlock ();
    return TRUE;
  }

  return FALSE;
}

static inline void orc_once_leave(OrcOnce *once, void *value) {
  once->value = value;
  once->inited = TRUE;
  orc_once_mutex_unlock ();
}

#endif

ORC_END_DECLS

#endif

