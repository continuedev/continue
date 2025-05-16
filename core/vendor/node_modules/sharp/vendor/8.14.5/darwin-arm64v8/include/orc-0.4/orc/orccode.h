
#ifndef _ORC_CODE_H_
#define _ORC_CODE_H_

#include <orc/orc.h>
#include <orc/orclimits.h>
#include <orc/orcexecutor.h>
#include <orc/orcinstruction.h>

ORC_BEGIN_DECLS

typedef struct _OrcCodeVariable OrcCodeVariable;


struct _OrcCodeVariable {
  /*< private >*/
  int vartype;
  int size;
  orc_union64 value;
};

struct _OrcCode {
  /*< public >*/
  OrcExecutorFunc exec;

  /*< private >*/
  OrcCompileResult result;
  char *name;

  /* for execution */
  unsigned char *code;
  int code_size;
  void *chunk;

  /* for emulation */
  int n_insns;
  OrcInstruction *insns;
  OrcCodeVariable *vars;
  int is_2d;
  int constant_n;
  int constant_m;
};


ORC_API void orc_code_allocate_codemem (OrcCode *code, int size);

ORC_API OrcCode * orc_code_new (void);
ORC_API void      orc_code_free (OrcCode *code);

ORC_END_DECLS

#endif

