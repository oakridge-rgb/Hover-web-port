/* Single-threaded wasm host: pthreads become no-ops.
 * Threads that win32hle would create (timers, audio feeder, guest threads)
 * are serviced from the JS pump instead, or fail gracefully as the C already
 * arranges when pthread_create returns non-zero. */
#ifndef PTHREAD_STUB_H
#define PTHREAD_STUB_H

typedef unsigned long pthread_t;
typedef struct { int v; } pthread_mutex_t;
typedef struct { int v; } pthread_cond_t;
typedef struct { unsigned v; } pthread_attr_t;
typedef struct { unsigned v; } pthread_mutexattr_t;
typedef struct { unsigned v; } pthread_condattr_t;

#define PTHREAD_MUTEX_INITIALIZER {0}
#define PTHREAD_COND_INITIALIZER {0}

static inline int pthread_create(pthread_t *t, const pthread_attr_t *a,
                                 void *(*fn)(void *), void *arg) { (void)t; (void)a; (void)fn; (void)arg; return -1; }
static inline int pthread_join(pthread_t t, void **r) { (void)t; (void)r; return 0; }
static inline int pthread_mutex_init(pthread_mutex_t *m, const pthread_mutexattr_t *a) { (void)a; m->v = 0; return 0; }
static inline int pthread_mutex_lock(pthread_mutex_t *m) { (void)m; return 0; }
static inline int pthread_mutex_unlock(pthread_mutex_t *m) { (void)m; return 0; }
static inline int pthread_mutex_destroy(pthread_mutex_t *m) { (void)m; return 0; }
static inline int pthread_cond_init(pthread_cond_t *c, const pthread_condattr_t *a) { (void)a; c->v = 0; return 0; }
static inline int pthread_cond_signal(pthread_cond_t *c) { (void)c; return 0; }
static inline int pthread_cond_broadcast(pthread_cond_t *c) { (void)c; return 0; }
static inline int pthread_cond_destroy(pthread_cond_t *c) { (void)c; return 0; }
static inline int pthread_cond_wait(pthread_cond_t *c, pthread_mutex_t *m) { (void)c; (void)m; return 0; }
static inline int pthread_cond_timedwait(pthread_cond_t *c, pthread_mutex_t *m, const void *ts) { (void)c; (void)m; (void)ts; return 0; }
static inline int pthread_equal(pthread_t a, pthread_t b) { return a == b; }
static inline pthread_t pthread_self(void) { return 0; }

#endif
