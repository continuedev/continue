
#ifndef _ORC_PROGRAM_H_
#define _ORC_PROGRAM_H_

#include <orc/orc.h>
#include <orc/orclimits.h>
#include <orc/orcexecutor.h>
#include <orc/orccode.h>
#include <orc/orcbytecode.h>
#include <orc/orccompiler.h>
#include <orc/orctarget.h>
#include <orc/orcrule.h>

ORC_BEGIN_DECLS


#define ORC_PROGRAM_ERROR(program, ...) do { \
  program->error = TRUE; \
  orc_debug_print(ORC_DEBUG_WARNING, __FILE__, ORC_FUNCTION, __LINE__, __VA_ARGS__); \
} while (0)

/**
 * OrcProgram:
 *
 * The OrcProgram structure has no public members
 */
struct _OrcProgram {
  /*< private >*/
  struct {
    OrcStaticOpcode *opcode;
    int dest_args[ORC_STATIC_OPCODE_N_DEST];
    int src_args[ORC_STATIC_OPCODE_N_SRC];

    OrcRule *rule;
  } _unused[ORC_N_INSNS]; /* needed for ABI compatibility */
  int n_insns;

  struct {
    char *name;
    char *type_name;

    int size;
    OrcVarType vartype;

    int used;
    int first_use;
    int last_use;
    int replaced;
    int replacement;

    int alloc;
    int is_chained;
    int is_aligned;
    int is_uncached;

    int value;

    int ptr_register;
    int ptr_offset;
    int mask_alloc;
    int aligned_data;
    int param_type;
    int load_dest;
  } _unused3[ORC_N_VARIABLES]; /* needed for ABI compatibility */

  int n_src_vars;
  int n_dest_vars;
  int n_param_vars;
  int n_const_vars;
  int n_temp_vars;
  int n_accum_vars;

  char *name;
  char *asm_code;

  unsigned char *_unused2;
  /* The offset of code_exec in this structure is part of the ABI */
  void *code_exec;

  OrcInstruction insns[ORC_N_INSNS];
  OrcVariable vars[ORC_N_VARIABLES];

  void *backup_func;
  char *backup_name;
  int is_2d;
  int constant_n;
  int n_multiple;
  int n_minimum;
  int n_maximum;
  int constant_m;

  OrcCode *orccode;

  /* Hide this here.  Belongs in a Parser object */
  char *init_function;
  char *error_msg;
  unsigned int current_line;
};

#define ORC_SRC_ARG(p,i,n) ((p)->vars[(i)->src_args[(n)]].alloc)
#define ORC_DEST_ARG(p,i,n) ((p)->vars[(i)->dest_args[(n)]].alloc)
#define ORC_SRC_TYPE(p,i,n) ((p)->vars[(i)->src_args[(n)]].vartype)
#define ORC_DEST_TYPE(p,i,n) ((p)->vars[(i)->dest_args[(n)]].vartype)
#define ORC_SRC_VAL(p,insn,n) ((p)->vars[(insn)->src_args[(n)]].value.i)
#define ORC_DEST_VAL(p,insn,n) ((p)->vars[(insn)->dest_args[(n)]].value.i)


ORC_API void orc_init (void);

ORC_API OrcProgram * orc_program_new (void);
ORC_API OrcProgram * orc_program_new_ds (int size1, int size2);
ORC_API OrcProgram * orc_program_new_dss (int size1, int size2, int size3);
ORC_API OrcProgram * orc_program_new_as (int size1, int size2);
ORC_API OrcProgram * orc_program_new_ass (int size1, int size2, int size3);
ORC_API OrcProgram * orc_program_new_from_static_bytecode (const orc_uint8 *bytecode);

ORC_API const char * orc_program_get_name (OrcProgram *program);
ORC_API void orc_program_set_name (OrcProgram *program, const char *name);
ORC_API void orc_program_set_line (OrcProgram *program, unsigned int line);
ORC_API void orc_program_set_2d (OrcProgram *program);
ORC_API void orc_program_set_constant_n (OrcProgram *program, int n);
ORC_API void orc_program_set_n_multiple (OrcProgram *ex, int n);
ORC_API void orc_program_set_n_minimum (OrcProgram *ex, int n);
ORC_API void orc_program_set_n_maximum (OrcProgram *ex, int n);
ORC_API void orc_program_set_constant_m (OrcProgram *program, int m);

ORC_API void orc_program_append (OrcProgram *p, const char *opcode, int arg0, int arg1, int arg2);
ORC_API void orc_program_append_2 (OrcProgram *program, const char *name,
    unsigned int flags, int arg0, int arg1, int arg2, int arg3);
ORC_API void orc_program_append_str (OrcProgram *p, const char *opcode,
    const char * arg0, const char * arg1, const char * arg2);
ORC_API void orc_program_append_str_2 (OrcProgram *program, const char *name,
    unsigned int flags, const char *arg1, const char *arg2, const char *arg3,
    const char *arg4);
ORC_API int orc_program_append_str_n (OrcProgram *program, const char *name,
    unsigned int flags, int argc, const char **argv);
ORC_API void orc_program_append_ds (OrcProgram *program, const char *opcode, int arg0,
    int arg1);
ORC_API void orc_program_append_ds_str (OrcProgram *p, const char *opcode,
    const char * arg0, const char * arg1);
ORC_API void orc_program_append_dds_str (OrcProgram *program, const char *name,
    const char *arg1, const char *arg2, const char *arg3);

ORC_API OrcCompileResult orc_program_compile (OrcProgram *p);
ORC_API OrcCompileResult orc_program_compile_for_target (OrcProgram *p, OrcTarget *target);
ORC_API OrcCompileResult orc_program_compile_full (OrcProgram *p, OrcTarget *target,
    unsigned int flags);
ORC_API void orc_program_set_backup_function (OrcProgram *p, OrcExecutorFunc func);
ORC_API void orc_program_set_backup_name (OrcProgram *p, const char *name);
ORC_API void orc_program_free (OrcProgram *program);

ORC_API int orc_program_find_var_by_name (OrcProgram *program, const char *name);

ORC_API int orc_program_add_temporary (OrcProgram *program, int size, const char *name);
ORC_API int orc_program_dup_temporary (OrcProgram *program, int i, int j);
ORC_API int orc_program_add_source (OrcProgram *program, int size, const char *name);
ORC_API int orc_program_add_source_full (OrcProgram *program, int size, const char *name,
    const char *type_name, int alignment);
ORC_API int orc_program_add_destination (OrcProgram *program, int size, const char *name);
ORC_API int orc_program_add_destination_full (OrcProgram *program, int size, const char *name,
    const char *type_name, int alignment);
ORC_API int orc_program_add_constant (OrcProgram *program, int size, int value, const char *name);
ORC_API int orc_program_add_constant_int64 (OrcProgram *program, int size, orc_int64 value, const char *name);
ORC_API int orc_program_add_constant_float (OrcProgram *program, int size, float value, const char *name);
ORC_API int orc_program_add_constant_double (OrcProgram *program, int size, double value, const char *name);
ORC_API int orc_program_add_constant_str (OrcProgram *program, int size, const char *value, const char *name);
ORC_API int orc_program_add_parameter (OrcProgram *program, int size, const char *name);
ORC_API int orc_program_add_parameter_float (OrcProgram *program, int size, const char *name);
ORC_API int orc_program_add_parameter_double (OrcProgram *program, int size, const char *name);
ORC_API int orc_program_add_parameter_int64 (OrcProgram *program, int size, const char *name);
ORC_API int orc_program_add_accumulator (OrcProgram *program, int size, const char *name);
ORC_API void orc_program_set_type_name (OrcProgram *program, int var, const char *type_name);
ORC_API void orc_program_set_var_alignment (OrcProgram *program, int var, int alignment);
ORC_API void orc_program_set_sampling_type (OrcProgram *program, int var, int sampling_type);

ORC_API int orc_program_allocate_register (OrcProgram *program, int is_data);

ORC_API void orc_program_reset (OrcProgram *program);
ORC_API OrcCode *orc_program_take_code (OrcProgram *program);

ORC_API const char *orc_program_get_asm_code (OrcProgram *program);
ORC_API const char * orc_program_get_error (OrcProgram *program);
ORC_API void orc_program_set_error (OrcProgram *program, const char *error);

ORC_API int orc_program_get_max_array_size (OrcProgram *program);
ORC_API int orc_program_get_max_accumulator_size (OrcProgram *program);


ORC_END_DECLS

#endif

