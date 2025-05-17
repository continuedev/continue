
#ifndef _ORC_INTERNAL_H_
#define _ORC_INTERNAL_H_

#include <orc/orcutils.h>
#include <orc/orclimits.h>

ORC_BEGIN_DECLS

#ifdef ORC_ENABLE_UNSTABLE_API

/* FIXME: not sure why these are exported, no one needs to call these, that's
 * already done as part of orc_init() */
void orc_mmx_init (void);
void orc_sse_init (void);
void orc_arm_init (void);
void orc_powerpc_init (void);
void orc_c_init (void);
void orc_neon_init (void);
void orc_c64x_init (void);
void orc_c64x_c_init (void);
void orc_mips_init (void);

typedef struct _OrcCodeChunk OrcCodeChunk;

/* This is internal API, nothing in the public headers returns an OrcCodeChunk */
void orc_code_chunk_free (OrcCodeChunk *chunk);

extern int _orc_data_cache_size_level1;
extern int _orc_data_cache_size_level2;
extern int _orc_data_cache_size_level3;
extern int _orc_cpu_family;
extern int _orc_cpu_model;
extern int _orc_cpu_stepping;
extern const char *_orc_cpu_name;

void orc_compiler_emit_invariants (OrcCompiler *compiler);
int orc_program_has_float (OrcCompiler *compiler);

char* _orc_getenv (const char *var);
#endif

ORC_END_DECLS

#endif

