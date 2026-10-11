using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
namespace Movers.DAL.Persistence;
internal static class CurrencyPrecisionSchema {
 public static async Task Apply(MoversDbContext db) {
  if(db.Database.IsSqlite())return;
  foreach(var entity in db.Model.GetEntityTypes()) {
   var table=entity.GetTableName();if(table is null)continue;
   foreach(var property in entity.GetProperties().Where(x=>x.GetPrecision()==20&&x.GetScale()==4)) {
    var column=property.GetColumnName(StoreObjectIdentifier.Table(table,entity.GetSchema()));if(column is null)continue;
    // Identifiers come exclusively from trusted EF model metadata, never request input.
    var schema=entity.GetSchema()??(db.Database.IsSqlServer()?"dbo":"public");
    if(db.Database.IsSqlServer()) {
     var sql=$"IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=N'{schema}' AND TABLE_NAME=N'{table}' AND COLUMN_NAME=N'{column}' AND NUMERIC_SCALE<4) ALTER TABLE [{schema}].[{table}] ALTER COLUMN [{column}] decimal(20,4) {(property.IsNullable?"NULL":"NOT NULL")};";
     await db.Database.ExecuteSqlRawAsync(sql);
    } else if(db.Database.IsNpgsql()) {
     var sql=$"DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='{schema}' AND table_name='{table}' AND column_name='{column}' AND numeric_scale<4) THEN ALTER TABLE \"{schema}\".\"{table}\" ALTER COLUMN \"{column}\" TYPE numeric(20,4); END IF; END $$;";
     await db.Database.ExecuteSqlRawAsync(sql);
    }
   }
  }
 }
}
